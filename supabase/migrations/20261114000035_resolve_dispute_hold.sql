-- ========================================================
-- TEMAN BICARA: RESOLVE DISPUTE HOLD RPC & AUDIT COLUMNS (PRD-051 / T-220)
-- Migration: 20261114000035_resolve_dispute_hold.sql
-- ========================================================

-- 1. TAMBAH KOLOM AUDIT PADA TABEL DISPUTED_PAYOUT_HOLDS
ALTER TABLE public.disputed_payout_holds
    ADD COLUMN IF NOT EXISTS resolution_note TEXT,
    ADD COLUMN IF NOT EXISTS deducted_amount_rupiah BIGINT NOT NULL DEFAULT 0 CHECK (deducted_amount_rupiah >= 0);

COMMENT ON COLUMN public.disputed_payout_holds.resolution_note IS 'Catatan penjelasan admin saat membebaskan atau memotong saldo sengketa';
COMMENT ON COLUMN public.disputed_payout_holds.deducted_amount_rupiah IS 'Nominal rupiah aktual yang berhasil dipotong dari dompet mitra saat aksi deduct';

-- 2. RPC RESOLVE_DISPUTE_HOLD
CREATE OR REPLACE FUNCTION public.resolve_dispute_hold(
    p_hold_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_hold public.disputed_payout_holds%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_target BIGINT;
    v_deduct_avail BIGINT := 0;
    v_deduct_pending BIGINT := 0;
    v_actual_deducted BIGINT := 0;
    v_updated_hold public.disputed_payout_holds%ROWTYPE;
    v_result JSONB;
BEGIN
    -- 1. Validasi argumen
    IF p_hold_id IS NULL OR p_admin_id IS NULL OR p_action IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS' USING ERRCODE = '22023';
    END IF;

    IF p_action NOT IN ('clear', 'deduct') THEN
        RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
    END IF;

    -- 2. Kunci baris sengketa FOR UPDATE
    SELECT * INTO v_hold
    FROM public.disputed_payout_holds
    WHERE id = p_hold_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HOLD_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_hold.status <> 'active' THEN
        RAISE EXCEPTION 'HOLD_ALREADY_RESOLVED' USING ERRCODE = 'P0001';
    END IF;

    -- 3. Aksi 'clear' (Bebaskan penahanan tanpa mutasi dompet/buku besar)
    IF p_action = 'clear' THEN
        UPDATE public.disputed_payout_holds
        SET status = 'cleared',
            resolved_at = pg_catalog.now(),
            resolved_by = p_admin_id,
            resolution_note = p_note,
            deducted_amount_rupiah = 0
        WHERE id = p_hold_id
        RETURNING * INTO v_updated_hold;

        v_result := pg_catalog.to_jsonb(v_updated_hold);
        RETURN v_result;
    END IF;

    -- 4. Aksi 'deduct' (Potong saldo bertingkat: available lalu pending)
    IF p_action = 'deduct' THEN
        -- Pastikan baris dompet mitra ada & kunci FOR UPDATE
        INSERT INTO public.wallets(user_id) VALUES(v_hold.mitra_id) ON CONFLICT(user_id) DO NOTHING;

        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_hold.mitra_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'WALLET_NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;

        -- Hitung pemotongan bertingkat
        v_target := v_hold.disputed_amount_rupiah;

        -- Porsi 1: potong dari available_rupiah sebatas saldo yang ada
        v_deduct_avail := pg_catalog.least(v_wallet.available_rupiah, v_target);
        IF v_deduct_avail < 0 THEN
            v_deduct_avail := 0;
        END IF;

        -- Porsi 2: sisa target dipotong dari pending_rupiah sebatas saldo yang ada
        v_deduct_pending := pg_catalog.least(v_wallet.pending_rupiah, v_target - v_deduct_avail);
        IF v_deduct_pending < 0 THEN
            v_deduct_pending := 0;
        END IF;

        v_actual_deducted := v_deduct_avail + v_deduct_pending;

        -- Perbarui saldo dompet mitra
        IF v_actual_deducted > 0 THEN
            UPDATE public.wallets
            SET available_rupiah = available_rupiah - v_deduct_avail,
                pending_rupiah = pending_rupiah - v_deduct_pending,
                updated_at = pg_catalog.now()
            WHERE user_id = v_hold.mitra_id;
        END IF;

        -- Catat baris pembalik ke ledger_entries untuk tiap akun yang terpotong > 0
        IF v_deduct_avail > 0 THEN
            INSERT INTO public.ledger_entries (
                user_id,
                account,
                amount,
                unit,
                reason,
                ref_type,
                ref_id
            ) VALUES (
                v_hold.mitra_id,
                'mitra_available',
                -v_deduct_avail,
                'rupiah',
                'dispute_deduct',
                'dispute_hold',
                p_hold_id
            );
        END IF;

        IF v_deduct_pending > 0 THEN
            INSERT INTO public.ledger_entries (
                user_id,
                account,
                amount,
                unit,
                reason,
                ref_type,
                ref_id
            ) VALUES (
                v_hold.mitra_id,
                'mitra_pending',
                -v_deduct_pending,
                'rupiah',
                'dispute_deduct',
                'dispute_hold',
                p_hold_id
            );
        END IF;

        -- Perbarui metadata sengketa hold
        UPDATE public.disputed_payout_holds
        SET status = 'deducted',
            resolved_at = pg_catalog.now(),
            resolved_by = p_admin_id,
            resolution_note = p_note,
            deducted_amount_rupiah = v_actual_deducted
        WHERE id = p_hold_id
        RETURNING * INTO v_updated_hold;

        v_result := pg_catalog.to_jsonb(v_updated_hold);
        RETURN v_result;
    END IF;

    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) IS 'RPC untuk menyelesaikan sengketa hold payout mitra (clear atau deduct bertingkat) secara atomik';
