-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST SUITE FASE 2 TAMBAHAN
-- Scope:
-- 1. Penambahan kolom topup_orders.expires_at & snap_redirect_url
-- 2. Partial index topup_orders_stale_pending_idx
-- 3. RPC topup_order_create (expires_at 10 menit)
-- 4. Helper apply_wallet_ledger_internal (kredit boleh untuk user non-aktif, debit wajib aktif)
-- 5. RPC topup_settle (PENTING: uang aman, status 'expire' & pasien suspended tetap dikreditkan koinnya)
-- 6. RPC topup_expire_stale (pending -> expire jika now > expires_at + 15 menit)
-- 7. Verifikasi debit ditolak untuk user suspended, idempotensi, dan proteksi deny/cancel
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('topup', '{"min_coins": 10, "max_coins": 500}'::jsonb),
    ('tip', '{"min_coins": 1, "max_coins": 50, "daily_cap_coins_per_patient": 50}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('payout', '{"min_rupiah": 1000000, "max_rupiah": 10000000, "fee_rupiah": 6500}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. SETUP USER TEST: auth.users (to satisfy users_id_fkey)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_pasien_phase2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_psikolog_phase2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a5000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_suspended_pasien_phase2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. SETUP USER TEST: public.users & profil
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'dryrun_pasien_phase2@temanbicara.test', '081111110001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000002', 'dryrun_psikolog_phase2@temanbicara.test', '081111110002', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('a5000000-0000-0000-0000-000000000005', 'dryrun_suspended_pasien_phase2@temanbicara.test', '081111110005', 'pasien'::public.user_role, 'suspended'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO public.pasien_profiles (user_id, nama_lengkap)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Dryrun Pasien Active'),
    ('a5000000-0000-0000-0000-000000000005', 'Dryrun Pasien Suspended')
ON CONFLICT (user_id) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap;

INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url)
VALUES ('a2000000-0000-0000-0000-000000000002', 'Dr. Dryrun Psikolog, M.Psi', 'STR-DRYRUN-001', 'https://example.com/str.pdf')
ON CONFLICT (user_id) DO UPDATE SET nama_lengkap_gelar = EXCLUDED.nama_lengkap_gelar;

-- INITIAL WALLETS FOR TEST USERS
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 0, 0, 0),
    ('a2000000-0000-0000-0000-000000000002', 0, 0, 0),
    ('a5000000-0000-0000-0000-000000000005', 0, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = 0;


-- ========================================================
-- SALINAN PERSIS DARI supabase/migrations/20261016000004_topup_expiry_and_history.sql
-- (Bagian DDL dan RPCs, tanpa BEGIN/COMMIT dan tanpa pg_cron)
-- ========================================================

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

-- TEST 4: PENTING (UANG) - Pasien Suspended dengan Order Pending TETAP Dikreditkan Koinnya
DO $$
DECLARE
    v_order_suspended TEXT := 'TOPUP-SUSPENDED-006';
    v_patient_id UUID := 'a5000000-0000-0000-0000-000000000005';
    v_initial_coins BIGINT;
    v_after_coins BIGINT;
    v_settle_res BOOLEAN;
    v_ledger_found BOOLEAN;
    v_order_row public.topup_orders%ROWTYPE;
BEGIN
    -- Verifikasi pasien memang dalam status suspended
    PERFORM 1 FROM public.users WHERE id = v_patient_id AND status = 'suspended'::public.account_status;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST 4 SETUP FAILED: User bukan pasien suspended';
    END IF;

    -- Pasien membuat order sebelum di-suspend (order pending Rp 250.000 = 25 koin)
    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, expires_at)
    VALUES (v_order_suspended, v_patient_id, 25, 250000, 'pending'::public.payment_status, pg_catalog.now() + INTERVAL '10 minutes');

    SELECT coin_balance INTO v_initial_coins FROM public.wallets WHERE user_id = v_patient_id;

    -- Webhook Midtrans masuk setelah akun di-suspend -> WAJIB SUKSES kredit
    v_settle_res := public.topup_settle(v_order_suspended, 'MIDTRANS-SUSPENDED-REF-777', 250000);

    IF NOT v_settle_res THEN
        RAISE EXCEPTION 'TEST 4 FAILED: topup_settle untuk pasien suspended harus menghasilkan true';
    END IF;

    -- Saldo dompet koin pasien suspended bertambah 25 koin
    SELECT coin_balance INTO v_after_coins FROM public.wallets WHERE user_id = v_patient_id;
    IF v_after_coins <> v_initial_coins + 25 THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Saldo koin pasien suspended tidak bertambah 25! Awal: %, Akhir: %', v_initial_coins, v_after_coins;
    END IF;

    -- Ledger tercatat
    SELECT EXISTS (
        SELECT 1 FROM public.ledger_entries
        WHERE user_id = v_patient_id
          AND account = 'patient_coins'
          AND amount = 25
          AND unit = 'coin'
          AND reason = 'topup_settled'
          AND ref_type = 'topup_order'
    ) INTO v_ledger_found;

    IF NOT v_ledger_found THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Ledger entry untuk pasien suspended tidak ditemukan';
    END IF;

    -- Status order berubah ke settlement
    SELECT * INTO v_order_row FROM public.topup_orders WHERE order_id = v_order_suspended;
    IF v_order_row.status <> 'settlement'::public.payment_status OR v_order_row.settled_at IS NULL THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Status order di topup_orders bukan settlement';
    END IF;
END;
$$;

-- TEST 5: Pasien Suspended TIDAK BISA Didebit (apply_wallet_ledger_internal memicu USER_NOT_ACTIVE)
DO $$
DECLARE
    v_patient_id UUID := 'a5000000-0000-0000-0000-000000000005';
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.apply_wallet_ledger_internal(
            v_patient_id,
            'patient_coins',
            -10, -- percobaan debit 10 koin
            'coin',
            'tip_debit',
            'tip',
            pg_catalog.gen_random_uuid()
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM LIKE '%USER_NOT_ACTIVE%' THEN
            v_caught := TRUE;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Debit pada pasien suspended harus ditolak dengan USER_NOT_ACTIVE';
    END IF;
END;
$$;

-- TEST 6: Proteksi Order Berstatus 'deny' & 'cancel' TIDAK Boleh di-Settle
DO $$
DECLARE
    v_order_deny TEXT := 'TOPUP-DENY-007';
    v_order_cancel TEXT := 'TOPUP-CANCEL-008';
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
        RAISE EXCEPTION 'TEST 6 FAILED: topup_settle pada order deny harus memicu exception P0001';
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
        RAISE EXCEPTION 'TEST 6 FAILED: topup_settle pada order cancel harus memicu exception P0001';
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK (DATABASE TETAP BERSIH)
-- ========================================================
SELECT 'SEMUA TEST TOPUP EXPIRY & SETTLEMENT LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
