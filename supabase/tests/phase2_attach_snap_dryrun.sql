-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST RPC TOPUP_ATTACH_SNAP
-- Scope:
-- 1. Penambahan snap_redirect_url pada order pending (sukses return true)
-- 2. Idempotensi: snap_redirect_url tidak ditimpa jika sudah ada (return false)
-- 3. Proteksi status: order non-pending ditolak dengan exception P0001 (TOPUP_NOT_PENDING)
-- 4. Proteksi order tidak ditemukan: exception P0002 (TOPUP_ORDER_NOT_FOUND)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES ('topup', '{"min_coins": 10, "max_coins": 500}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. SETUP USER TEST: auth.users (to satisfy users_id_fkey)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_pasien_attach@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. SETUP USER TEST: public.users & profil
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'dryrun_pasien_attach@temanbicara.test', '081111110001', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO public.pasien_profiles (user_id, nama_lengkap)
VALUES ('a1000000-0000-0000-0000-000000000001', 'Dryrun Pasien Attach')
ON CONFLICT (user_id) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap;

INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES ('a1000000-0000-0000-0000-000000000001', 0, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = 0;

-- 4. PASTIKAN KOLOM & RPC TERSEDIA
ALTER TABLE public.topup_orders
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snap_redirect_url TEXT;

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

    IF v_role IS NULL THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
    IF v_role <> 'pasien' THEN RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
    IF p_order_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_order_id)) = 0 THEN RAISE EXCEPTION 'INVALID_ORDER_ID' USING ERRCODE='22023'; END IF;

    SELECT (value->>'min_coins')::BIGINT, (value->>'max_coins')::BIGINT INTO v_min, v_max
    FROM public.system_settings WHERE key = 'topup';

    IF v_min IS NULL OR v_max IS NULL THEN RAISE EXCEPTION 'SETTING_TOPUP_INVALID' USING ERRCODE='22023'; END IF;
    IF p_coins < v_min OR p_coins > v_max THEN RAISE EXCEPTION 'TOPUP_COINS_OUT_OF_RANGE' USING ERRCODE='22023'; END IF;

    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, expires_at)
    VALUES (p_order_id, p_patient_id, p_coins, p_coins * 10000, 'pending'::public.payment_status, COALESCE(p_expires_at, pg_catalog.now() + INTERVAL '10 minutes'))
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 5. RPC TOPUP_ATTACH_SNAP
CREATE OR REPLACE FUNCTION public.topup_attach_snap(
    p_order_id TEXT,
    p_redirect_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.topup_orders%ROWTYPE;
BEGIN
    IF p_order_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_order_id)) = 0 THEN
        RAISE EXCEPTION 'INVALID_ORDER_ID' USING ERRCODE='22023';
    END IF;

    IF p_redirect_url IS NULL OR pg_catalog.length(pg_catalog.btrim(p_redirect_url)) = 0 THEN
        RAISE EXCEPTION 'INVALID_REDIRECT_URL' USING ERRCODE='22023';
    END IF;

    SELECT * INTO v_order
    FROM public.topup_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TOPUP_ORDER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    IF v_order.status <> 'pending'::public.payment_status THEN
        RAISE EXCEPTION 'TOPUP_NOT_PENDING' USING ERRCODE='P0001';
    END IF;

    -- Set HANYA jika snap_redirect_url masih NULL
    IF v_order.snap_redirect_url IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.topup_orders
    SET snap_redirect_url = p_redirect_url
    WHERE id = v_order.id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.topup_attach_snap(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_attach_snap(TEXT, TEXT) TO service_role;


-- ========================================================
-- EKSEKUSI PENGUJIAN OTOMATIS
-- ========================================================

-- TEST 1: Set snap_redirect_url pada order pending (harus berhasil return true)
DO $$
DECLARE
    v_order_id TEXT := 'TOPUP-ATTACH-TEST-001';
    v_res BOOLEAN;
    v_url TEXT;
BEGIN
    PERFORM public.topup_order_create(v_order_id, 'a1000000-0000-0000-0000-000000000001', 20);

    v_res := public.topup_attach_snap(v_order_id, 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap001');
    IF NOT v_res THEN
        RAISE EXCEPTION 'TEST 1 FAILED: topup_attach_snap harus return true saat url masih null';
    END IF;

    SELECT snap_redirect_url INTO v_url FROM public.topup_orders WHERE order_id = v_order_id;
    IF v_url <> 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap001' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: snap_redirect_url di database mismatch: %', v_url;
    END IF;
END;
$$;

-- TEST 2: Idempotensi: pemanggilan kedua tidak mengubah nilai dan return false
DO $$
DECLARE
    v_order_id TEXT := 'TOPUP-ATTACH-TEST-001';
    v_res BOOLEAN;
    v_url TEXT;
BEGIN
    v_res := public.topup_attach_snap(v_order_id, 'https://app.sandbox.midtrans.com/snap/v2/vtweb/DIFFERENT');
    IF v_res THEN
        RAISE EXCEPTION 'TEST 2 FAILED: topup_attach_snap harus return false jika url sudah pernah diset';
    END IF;

    SELECT snap_redirect_url INTO v_url FROM public.topup_orders WHERE order_id = v_order_id;
    IF v_url <> 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap001' THEN
        RAISE EXCEPTION 'TEST 2 FAILED: snap_redirect_url tertimpa pada pemanggilan kedua: %', v_url;
    END IF;
END;
$$;

-- TEST 3: Order non-pending ditolak dengan exception P0001 (TOPUP_NOT_PENDING)
DO $$
DECLARE
    v_order_settled TEXT := 'TOPUP-ATTACH-SETTLED-002';
    v_order_expired TEXT := 'TOPUP-ATTACH-EXPIRED-003';
    v_caught BOOLEAN;
BEGIN
    -- Order settlement
    PERFORM public.topup_order_create(v_order_settled, 'a1000000-0000-0000-0000-000000000001', 20);
    UPDATE public.topup_orders SET status = 'settlement'::public.payment_status WHERE order_id = v_order_settled;

    v_caught := FALSE;
    BEGIN
        PERFORM public.topup_attach_snap(v_order_settled, 'https://snap.mock/settled');
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM LIKE '%TOPUP_NOT_PENDING%' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 3.1 FAILED: attach snap pada order settlement harus raise P0001 TOPUP_NOT_PENDING';
    END IF;

    -- Order expire
    PERFORM public.topup_order_create(v_order_expired, 'a1000000-0000-0000-0000-000000000001', 20);
    UPDATE public.topup_orders SET status = 'expire'::public.payment_status WHERE order_id = v_order_expired;

    v_caught := FALSE;
    BEGIN
        PERFORM public.topup_attach_snap(v_order_expired, 'https://snap.mock/expired');
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM LIKE '%TOPUP_NOT_PENDING%' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 3.2 FAILED: attach snap pada order expire harus raise P0001 TOPUP_NOT_PENDING';
    END IF;
END;
$$;

-- TEST 4: Order tidak ditemukan ditolak dengan exception P0002 (TOPUP_ORDER_NOT_FOUND)
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.topup_attach_snap('TOPUP-NONEXISTENT-999', 'https://snap.mock/none');
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        IF SQLERRM LIKE '%TOPUP_ORDER_NOT_FOUND%' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 4 FAILED: order tidak ditemukan harus raise P0002 TOPUP_ORDER_NOT_FOUND';
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK (DATABASE TETAP BERSIH)
-- ========================================================
SELECT 'SEMUA TEST RPC TOPUP_ATTACH_SNAP LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
