-- ========================================================
-- TEMAN BICARA: DISPUTED_PAYOUT_HOLDS & RPC CREATE_DISPUTE_HOLDS (PRD-050 / T-215)
-- Migration: 20261113000034_disputed_payout_holds.sql
-- ========================================================

-- 1. TABEL DISPUTED_PAYOUT_HOLDS
CREATE TABLE IF NOT EXISTS public.disputed_payout_holds (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    topup_order_id UUID NOT NULL REFERENCES public.topup_orders(id) ON DELETE RESTRICT,
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    source_type TEXT NOT NULL CHECK (source_type IN ('session', 'extension', 'tip')),
    source_id UUID NOT NULL,
    disputed_amount_rupiah BIGINT NOT NULL CHECK (disputed_amount_rupiah > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleared', 'deducted')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT disputed_payout_unique_source UNIQUE (topup_order_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS disputed_payout_mitra_idx ON public.disputed_payout_holds(mitra_id, status);

ALTER TABLE public.disputed_payout_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.disputed_payout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.disputed_payout_holds TO service_role;

-- 2. RPC CREATE_DISPUTE_HOLDS
CREATE OR REPLACE FUNCTION public.create_dispute_holds(
    p_topup_order_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
    v_settled_at TIMESTAMPTZ;
    v_coins BIGINT;
    v_cap_rupiah BIGINT;
    v_accumulated_rupiah BIGINT := 0;
    v_holds_created INTEGER := 0;
    v_rec RECORD;
    v_hold_amount BIGINT;
    v_inserted_id UUID;
BEGIN
    IF p_topup_order_id IS NULL THEN
        RETURN 0;
    END IF;

    -- 1. Ambil data pesanan topup
    SELECT patient_id, settled_at, coins
    INTO v_patient_id, v_settled_at, v_coins
    FROM public.topup_orders
    WHERE id = p_topup_order_id;

    IF NOT FOUND OR v_settled_at IS NULL OR v_coins IS NULL OR v_coins <= 0 THEN
        RETURN 0;
    END IF;

    -- 2. Plafon rupiah bagi hasil mitra (80% dari total nominal rupiah koin)
    v_cap_rupiah := (v_coins * 10000 * 80) / 100;
    IF v_cap_rupiah <= 0 THEN
        RETURN 0;
    END IF;

    -- 3. Akumulasi hold yang sudah terbentuk untuk order topup ini (idempoten / retry safety)
    SELECT COALESCE(pg_catalog.sum(disputed_amount_rupiah), 0)
    INTO v_accumulated_rupiah
    FROM public.disputed_payout_holds
    WHERE topup_order_id = p_topup_order_id;

    IF v_accumulated_rupiah >= v_cap_rupiah THEN
        RETURN 0;
    END IF;

    -- 4. Tracing Taint Overlap Window ke mitra_earnings pasien pasca settled_at
    FOR v_rec IN (
        SELECT
            me.id AS earning_id,
            me.mitra_id,
            me.source_type,
            me.source_id,
            me.amount_rupiah,
            me.created_at
        FROM public.mitra_earnings me
        JOIN public.bookings b
          ON me.source_id = b.id
        WHERE me.source_type IN ('session', 'extension')
          AND b.patient_id = v_patient_id
          AND me.created_at >= v_settled_at
          AND NOT EXISTS (
              SELECT 1 FROM public.disputed_payout_holds dph
              WHERE dph.topup_order_id = p_topup_order_id
                AND dph.source_type = me.source_type
                AND dph.source_id = me.source_id
          )

        UNION ALL

        SELECT
            me.id AS earning_id,
            me.mitra_id,
            me.source_type,
            me.source_id,
            me.amount_rupiah,
            me.created_at
        FROM public.mitra_earnings me
        JOIN public.tips t
          ON me.source_id = t.id
        WHERE me.source_type = 'tip'
          AND t.patient_id = v_patient_id
          AND me.created_at >= v_settled_at
          AND NOT EXISTS (
              SELECT 1 FROM public.disputed_payout_holds dph
              WHERE dph.topup_order_id = p_topup_order_id
                AND dph.source_type = me.source_type
                AND dph.source_id = me.source_id
          )

        ORDER BY created_at ASC, earning_id ASC
    ) LOOP
        -- Batasi akumulasi hold sesuai plafon rupiah
        IF v_rec.amount_rupiah <= (v_cap_rupiah - v_accumulated_rupiah) THEN
            v_hold_amount := v_rec.amount_rupiah;
        ELSE
            v_hold_amount := v_cap_rupiah - v_accumulated_rupiah;
        END IF;

        IF v_hold_amount <= 0 THEN
            EXIT;
        END IF;

        v_inserted_id := NULL;

        INSERT INTO public.disputed_payout_holds (
            topup_order_id,
            mitra_id,
            source_type,
            source_id,
            disputed_amount_rupiah,
            status,
            reason
        ) VALUES (
            p_topup_order_id,
            v_rec.mitra_id,
            v_rec.source_type,
            v_rec.source_id,
            v_hold_amount,
            'active',
            'Penahanan sengketa pembayaran atas pesanan topup ' || p_topup_order_id::text
        )
        ON CONFLICT (topup_order_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            v_holds_created := v_holds_created + 1;
            v_accumulated_rupiah := v_accumulated_rupiah + v_hold_amount;

            IF v_accumulated_rupiah >= v_cap_rupiah THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;

    RETURN v_holds_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dispute_holds(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispute_holds(UUID) TO service_role;

COMMENT ON TABLE public.disputed_payout_holds IS 'Tabel metadata penahanan payout mitra ketika pesanan topup mengalami refund atau chargeback';
COMMENT ON FUNCTION public.create_dispute_holds(UUID) IS 'RPC untuk menahan payout mitra berdasarkan Taint Overlap Window saat pesanan topup sengketa';
