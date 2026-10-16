-- ========================================================
-- TEMAN BICARA: TOPUP EXPIRY, STALE ORDER CRON, & SETTLEMENT FOR EXPIRED ORDERS (FASE 2)
-- Eksekusi file ini di: Supabase Dashboard / CLI
-- Scope:
-- 1. Kolom topup_orders.expires_at dan snap_redirect_url
-- 2. Partial index untuk query order pending stale
-- 3. Update RPC topup_order_create untuk mencatat expires_at
-- 4. Update RPC topup_settle: order 'expire' tetap wajib dikreditkan koinnya jika uang masuk
-- 5. RPC topup_expire_stale() untuk menandai order pending kedaluwarsa (now > expires_at + 15 menit)
-- 6. Penjadwalan pg_cron topup-expire-stale-job setiap 15 menit
-- Semua SECURITY DEFINER memakai search_path = '' dan nama objek fully qualified.
-- ========================================================

BEGIN;

-- 1. TAMBAH KOLOM KE TABEL TOPUP_ORDERS
ALTER TABLE public.topup_orders
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snap_redirect_url TEXT;

-- Backfill data lama jika ada yang belum memiliki expires_at
UPDATE public.topup_orders
SET expires_at = created_at + INTERVAL '10 minutes'
WHERE expires_at IS NULL;

-- 2. PARTIAL INDEX UNTUK PENGECEKAN ORDER STALE PENDING
CREATE INDEX IF NOT EXISTS topup_orders_stale_pending_idx
ON public.topup_orders(expires_at)
WHERE status = 'pending'::public.payment_status;

-- 3. UPDATE RPC: topup_order_create
DROP FUNCTION IF EXISTS public.topup_order_create(TEXT, UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.topup_order_create(
    p_order_id TEXT,
    p_patient_id UUID,
    p_coins BIGINT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_min BIGINT;
    v_max BIGINT;
    v_id UUID;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_patient_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF p_order_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_order_id)) = 0 THEN
        RAISE EXCEPTION 'INVALID_ORDER_ID' USING ERRCODE='22023';
    END IF;

    SELECT (value->>'min_coins')::BIGINT, (value->>'max_coins')::BIGINT
    INTO v_min, v_max
    FROM public.system_settings
    WHERE key = 'topup';

    IF v_min IS NULL OR v_max IS NULL THEN
        RAISE EXCEPTION 'SETTING_TOPUP_INVALID' USING ERRCODE='22023';
    END IF;

    IF p_coins < v_min OR p_coins > v_max THEN
        RAISE EXCEPTION 'TOPUP_COINS_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.topup_orders (
        order_id,
        patient_id,
        coins,
        amount_rupiah,
        status,
        expires_at
    )
    VALUES (
        p_order_id,
        p_patient_id,
        p_coins,
        p_coins * 10000,
        'pending'::public.payment_status,
        COALESCE(p_expires_at, pg_catalog.now() + INTERVAL '10 minutes')
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.topup_order_create(TEXT, UUID, BIGINT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_order_create(TEXT, UUID, BIGINT, TIMESTAMPTZ) TO service_role;

-- 4. UPDATE INTERNAL HELPER: apply_wallet_ledger_internal
-- Aturan uang:
-- - p_delta > 0 (kredit: top-up, refund) boleh untuk user yang ADA walau tidak active (role tetap harus cocok).
-- - p_delta < 0 (debit) tetap WAJIB status active.
CREATE OR REPLACE FUNCTION public.apply_wallet_ledger_internal(
    p_user_id UUID,
    p_account TEXT,
    p_delta BIGINT,
    p_unit TEXT,
    p_reason TEXT,
    p_ref_type TEXT,
    p_ref_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_status public.account_status;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    v_role := NULL;
    v_status := NULL;

    SELECT u.role, u.status INTO v_role, v_status
    FROM public.users AS u
    WHERE u.id = p_user_id
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    -- Debit (p_delta < 0) WAJIB akun berstatus active
    IF p_delta < 0 AND v_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;

    IF (p_account = 'patient_coins' AND (v_role <> 'pasien' OR p_unit <> 'coin')) OR
       (p_account IN ('mitra_pending', 'mitra_available') AND (v_role NOT IN ('psikolog', 'relawan') OR p_unit <> 'rupiah')) THEN
        RAISE EXCEPTION 'WALLET_ROLE_MISMATCH' USING ERRCODE='42501';
    END IF;

    INSERT INTO public.wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

    IF p_account = 'patient_coins' THEN
        IF v_wallet.coin_balance + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_COINS' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET coin_balance = coin_balance + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSIF p_account = 'mitra_pending' THEN
        IF v_wallet.pending_rupiah + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET pending_rupiah = pending_rupiah + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSIF p_account = 'mitra_available' THEN
        IF v_wallet.available_rupiah + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET available_rupiah = available_rupiah + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSE
        RAISE EXCEPTION 'INVALID_LEDGER_ACCOUNT' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES(p_user_id, p_account, p_delta, p_unit, p_reason, p_ref_type, p_ref_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_ledger_internal(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;

-- 5. UPDATE RPC: topup_settle
-- PENTING (UANG): Order berstatus 'expire' WAJIB tetap mengkreditkan koin bila Midtrans melaporkan settlement valid.
CREATE OR REPLACE FUNCTION public.topup_settle(
    p_order_id TEXT,
    p_provider_reference TEXT,
    p_paid_amount_rupiah BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.topup_orders%ROWTYPE;
    v_role public.user_role;
BEGIN
    SELECT * INTO v_order
    FROM public.topup_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TOPUP_ORDER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = v_order.patient_id
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;
    IF v_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF v_order.status = 'settlement'::public.payment_status THEN
        RETURN FALSE;
    END IF;

    -- Proteksi uang: order pending maupun expire tetap boleh diselesaikan jika uang sudah masuk
    IF v_order.status NOT IN ('pending'::public.payment_status, 'expire'::public.payment_status) THEN
        RAISE EXCEPTION 'TOPUP_NOT_SETTLEABLE' USING ERRCODE='P0001';
    END IF;

    IF p_paid_amount_rupiah IS NULL OR p_paid_amount_rupiah <> v_order.amount_rupiah THEN
        RAISE EXCEPTION 'TOPUP_AMOUNT_MISMATCH' USING ERRCODE='22023';
    END IF;

    PERFORM public.apply_wallet_ledger_internal(
        v_order.patient_id,
        'patient_coins',
        v_order.coins,
        'coin',
        'topup_settled',
        'topup_order',
        v_order.id
    );

    UPDATE public.topup_orders
    SET status = 'settlement'::public.payment_status,
        provider_reference = p_provider_reference,
        settled_at = pg_catalog.now()
    WHERE id = v_order.id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.topup_settle(TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_settle(TEXT, TEXT, BIGINT) TO service_role;

-- 6. RPC JOB KEDALUWARSA: topup_expire_stale
CREATE OR REPLACE FUNCTION public.topup_expire_stale(
    p_batch_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_order_id TEXT;
BEGIN
    IF p_batch_limit < 1 OR p_batch_limit > 1000 THEN
        RAISE EXCEPTION 'INVALID_BATCH_LIMIT' USING ERRCODE='22023';
    END IF;

    FOR v_order_id IN
        SELECT o.order_id
        FROM public.topup_orders o
        WHERE o.status = 'pending'::public.payment_status
          AND o.expires_at IS NOT NULL
          AND pg_catalog.now() > o.expires_at + INTERVAL '15 minutes'
        ORDER BY o.expires_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_limit
    LOOP
        UPDATE public.topup_orders
        SET status = 'expire'::public.payment_status
        WHERE order_id = v_order_id
          AND status = 'pending'::public.payment_status;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.topup_expire_stale(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_expire_stale(INTEGER) TO service_role;

-- 7. PENJADWALAN PG_CRON (TIAP 15 MENIT)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus job sebelumnya jika sudah ada agar migrasi bersifat idempoten
SELECT cron.unschedule('topup-expire-stale-job')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'topup-expire-stale-job'
);

-- Jadwalkan pengecekan order kedaluwarsa setiap 15 menit
SELECT cron.schedule(
    'topup-expire-stale-job',
    '*/15 * * * *',
    'SELECT public.topup_expire_stale(100);'
);

COMMIT;
