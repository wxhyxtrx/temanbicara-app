-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST SUITE FASE 2 TAMBAHAN
-- Scope:
-- 1. Penambahan kolom topup_orders.expires_at & snap_redirect_url
-- 2. Partial index topup_orders_stale_pending_idx
-- 3. RPC topup_order_create (expires_at 10 menit)
-- 4. RPC topup_expire_stale (pending -> expire jika now > expires_at + 15 menit)
-- 5. RPC topup_settle (PENTING: uang aman, status 'expire' tetap dikreditkan koinnya)
-- 6. Verifikasi idempotensi dan proteksi deny/cancel
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. PASTIKAN USER TEST TERSEDIA (IDEMPOTEN)
INSERT INTO public.users (id, email, password_hash, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'dryrun.pasien@temanbicara.id', '$2b$10$dummyhashpasien', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000002', 'dryrun.psikolog@temanbicara.id', '$2b$10$dummyhashpsikolog', 'psikolog'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET status = 'active'::public.account_status;

INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES ('a1000000-0000-0000-0000-000000000001', 0, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = 0;

INSERT INTO public.system_settings (key, value)
VALUES ('topup', '{"min_coins": 10, "max_coins": 500}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. APLIKASIKAN DDL MIGRASI BARU
ALTER TABLE public.topup_orders
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snap_redirect_url TEXT;

UPDATE public.topup_orders
SET expires_at = created_at + INTERVAL '10 minutes'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS topup_orders_stale_pending_idx
ON public.topup_orders(expires_at)
WHERE status = 'pending'::public.payment_status;

-- 3. APLIKASIKAN RPC BARU: topup_order_create (10 Menit)
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

-- 4. APLIKASIKAN RPC BARU: topup_settle (Proteksi Uang untuk Order 'expire')
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
    WHERE u.id = v_order.patient_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF v_order.status = 'settlement'::public.payment_status THEN
        RETURN FALSE;
    END IF;

    -- PENTING (UANG): Order berstatus 'pending' ATAU 'expire' tetap wajib dikreditkan bila pembayaran sukses
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

-- 5. APLIKASIKAN RPC BARU: topup_expire_stale (Job Kedaluwarsa)
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


-- ========================================================
-- EKSEKUSI PENGUJIAN OTOMATIS
-- ========================================================

-- TEST 1: Pembuatan Order Topup & Kolom expires_at (10 Menit)
DO $$
DECLARE
    v_order_id TEXT := 'TOPUP-EXP-DRYRUN-001';
    v_row public.topup_orders%ROWTYPE;
BEGIN
    PERFORM public.topup_order_create(v_order_id, 'a1000000-0000-0000-0000-000000000001', 50);

    SELECT * INTO v_row FROM public.topup_orders WHERE order_id = v_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Order tidak ditemukan di topup_orders';
    END IF;

    IF v_row.expires_at IS NULL THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Kolom expires_at tidak terisi';
    END IF;

    IF v_row.expires_at <= pg_catalog.now() + INTERVAL '9 minutes' OR v_row.expires_at >= pg_catalog.now() + INTERVAL '11 minutes' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: expires_at tidak berada dalam rentang ~10 menit: %', v_row.expires_at;
    END IF;

    -- Simpan snap_redirect_url
    UPDATE public.topup_orders
    SET snap_redirect_url = 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock001'
    WHERE order_id = v_order_id;

    SELECT * INTO v_row FROM public.topup_orders WHERE order_id = v_order_id;
    IF v_row.snap_redirect_url <> 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock001' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: snap_redirect_url gagal disimpan';
    END IF;
END;
$$;

-- TEST 2: Job Kedaluwarsa Stale Order (topup_expire_stale)
DO $$
DECLARE
    v_order_stale TEXT := 'TOPUP-STALE-DRYRUN-002';
    v_order_grace TEXT := 'TOPUP-GRACE-DRYRUN-003';
    v_order_active TEXT := 'TOPUP-ACTIVE-DRYRUN-004';
    v_count INTEGER;
    v_stale_status public.payment_status;
    v_grace_status public.payment_status;
    v_active_status public.payment_status;
BEGIN
    -- 1. Order Stale: Kedaluwarsa 20 menit lalu (now > expires_at + 15m) -> HARUS expire
    PERFORM public.topup_order_create(v_order_stale, 'a1000000-0000-0000-0000-000000000001', 20, pg_catalog.now() - INTERVAL '20 minutes');

    -- 2. Order Grace: Kedaluwarsa 5 menit lalu (now <= expires_at + 15m) -> TETAP pending
    PERFORM public.topup_order_create(v_order_grace, 'a1000000-0000-0000-0000-000000000001', 20, pg_catalog.now() - INTERVAL '5 minutes');

    -- 3. Order Active: Masih aktif 5 menit ke depan -> TETAP pending
    PERFORM public.topup_order_create(v_order_active, 'a1000000-0000-0000-0000-000000000001', 20, pg_catalog.now() + INTERVAL '5 minutes');

    -- Jalankan job expire stale
    v_count := public.topup_expire_stale(100);
    IF v_count < 1 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: topup_expire_stale tidak memproses order stale (count=%)', v_count;
    END IF;

    SELECT status INTO v_stale_status FROM public.topup_orders WHERE order_id = v_order_stale;
    SELECT status INTO v_grace_status FROM public.topup_orders WHERE order_id = v_order_grace;
    SELECT status INTO v_active_status FROM public.topup_orders WHERE order_id = v_order_active;

    IF v_stale_status <> 'expire'::public.payment_status THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Order stale harus menjadi expire, aktual: %', v_stale_status;
    END IF;

    IF v_grace_status <> 'pending'::public.payment_status THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Order dalam masa grace 15 menit harus tetap pending, aktual: %', v_grace_status;
    END IF;

    IF v_active_status <> 'pending'::public.payment_status THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Order aktif harus tetap pending, aktual: %', v_active_status;
    END IF;
END;
$$;

-- TEST 3: PENTING (UANG) - Settlement pada Order Berstatus 'expire' Tetap Mengkreditkan Koin
DO $$
DECLARE
    v_order_expired TEXT := 'TOPUP-EXPIRED-MONEY-005';
    v_initial_coins BIGINT;
    v_after_coins BIGINT;
    v_settle_res BOOLEAN;
    v_ledger_found BOOLEAN;
    v_order_row public.topup_orders%ROWTYPE;
BEGIN
    -- Setup order berstatus 'expire' (30 koin = Rp 300.000)
    PERFORM public.topup_order_create(v_order_expired, 'a1000000-0000-0000-0000-000000000001', 30, pg_catalog.now() - INTERVAL '30 minutes');
    UPDATE public.topup_orders SET status = 'expire'::public.payment_status WHERE order_id = v_order_expired;

    SELECT coin_balance INTO v_initial_coins FROM public.wallets WHERE user_id = 'a1000000-0000-0000-0000-000000000001';

    -- Simulasi webhook Midtrans melaporkan status 'settlement' valid
    v_settle_res := public.topup_settle(v_order_expired, 'MIDTRANS-EXP-VALID-REF-999', 300000);

    IF NOT v_settle_res THEN
        RAISE EXCEPTION 'TEST 3 FAILED: topup_settle untuk order expired harus menghasilkan true';
    END IF;

    -- Verifikasi saldo koin bertambah 30 koin
    SELECT coin_balance INTO v_after_coins FROM public.wallets WHERE user_id = 'a1000000-0000-0000-0000-000000000001';
    IF v_after_coins <> v_initial_coins + 30 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Saldo koin tidak bertambah 30! Awal: %, Akhir: %', v_initial_coins, v_after_coins;
    END IF;

    -- Verifikasi catatan ledger append-only
    SELECT EXISTS (
        SELECT 1 FROM public.ledger_entries
        WHERE user_id = 'a1000000-0000-0000-0000-000000000001'
          AND account = 'patient_coins'
          AND amount = 30
          AND unit = 'coin'
          AND reason = 'topup_settled'
          AND ref_type = 'topup_order'
    ) INTO v_ledger_found;

    IF NOT v_ledger_found THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Mutasi ledger_entries untuk order expired settlement tidak ditemukan';
    END IF;

    -- Verifikasi status order berubah menjadi 'settlement'
    SELECT * INTO v_order_row FROM public.topup_orders WHERE order_id = v_order_expired;
    IF v_order_row.status <> 'settlement'::public.payment_status OR v_order_row.settled_at IS NULL OR v_order_row.provider_reference <> 'MIDTRANS-EXP-VALID-REF-999' THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Status order di topup_orders tidak ter-update ke settlement';
    END IF;

    -- Verifikasi IDEMPOTENSI: pemanggilan ulang topup_settle harus menghasilkan FALSE tanpa menambah saldo
    v_settle_res := public.topup_settle(v_order_expired, 'MIDTRANS-EXP-VALID-REF-999', 300000);
    IF v_settle_res THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Pemanggilan kedua topup_settle harus mengembalikan false (idempoten)';
    END IF;

    SELECT coin_balance INTO v_after_coins FROM public.wallets WHERE user_id = 'a1000000-0000-0000-0000-000000000001';
    IF v_after_coins <> v_initial_coins + 30 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Saldo koin berubah pada pemanggilan idempoten';
    END IF;
END;
$$;

-- TEST 4: Proteksi Order Berstatus 'deny' & 'cancel' TIDAK Boleh di-Settle
DO $$
DECLARE
    v_order_deny TEXT := 'TOPUP-DENY-006';
    v_order_cancel TEXT := 'TOPUP-CANCEL-007';
    v_caught BOOLEAN;
BEGIN
    PERFORM public.topup_order_create(v_order_deny, 'a1000000-0000-0000-0000-000000000001', 10);
    UPDATE public.topup_orders SET status = 'deny'::public.payment_status WHERE order_id = v_order_deny;

    v_caught := FALSE;
    BEGIN
        PERFORM public.topup_settle(v_order_deny, 'MIDTRANS-DENY-REF', 100000);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 4 FAILED: topup_settle pada order deny harus memicu exception P0001';
    END IF;

    PERFORM public.topup_order_create(v_order_cancel, 'a1000000-0000-0000-0000-000000000001', 10);
    UPDATE public.topup_orders SET status = 'cancel'::public.payment_status WHERE order_id = v_order_cancel;

    v_caught := FALSE;
    BEGIN
        PERFORM public.topup_settle(v_order_cancel, 'MIDTRANS-CANCEL-REF', 100000);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 4 FAILED: topup_settle pada order cancel harus memicu exception P0001';
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK (DATABASE TETAP BERSIH)
-- ========================================================
SELECT 'SEMUA TEST TOPUP EXPIRY & EXPIRED SETTLEMENT LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
