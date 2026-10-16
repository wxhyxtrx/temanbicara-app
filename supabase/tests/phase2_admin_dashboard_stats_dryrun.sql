-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST RPC ADMIN_DASHBOARD_STATS
-- Path: supabase/tests/admin_stats_dryrun.sql
-- Scope:
-- 1. DDL public.admin_dashboard_stats() persis dari migrasi 000006
-- 2. Uji hitung top-up all-time vs today (sejak 00:00 WIB / Asia/Jakarta)
-- 3. Uji antrean payout requested (status TEXT 'requested')
-- 4. Uji total platform_revenue dan breakdown per reason dari ledger_entries
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users (to satisfy users_id_fkey)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_admin_stats_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_admin_stats_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users & wallets
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'dryrun_admin_stats_pasien@temanbicara.test', '081111110001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000002', 'dryrun_admin_stats_psikolog@temanbicara.test', '081111110002', 'psikolog'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 100, 0, 0),
    ('a2000000-0000-0000-0000-000000000002', 0, 0, 5000000)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = EXCLUDED.coin_balance;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261016000006_admin_dashboard_stats.sql
-- ========================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(
    p_today_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_today_start TIMESTAMPTZ;
    v_all_orders BIGINT := 0;
    v_all_coins BIGINT := 0;
    v_all_rupiah BIGINT := 0;
    v_today_orders BIGINT := 0;
    v_today_coins BIGINT := 0;
    v_today_rupiah BIGINT := 0;
    v_payout_requested_count BIGINT := 0;
    v_payout_requested_rupiah BIGINT := 0;
    v_platform_rev BIGINT := 0;
    v_rev_breakdown JSONB := '{}'::jsonb;
BEGIN
    -- Hitung batas awal hari ini pukul 00:00 WIB (Asia/Jakarta)
    v_today_start := COALESCE(
        p_today_start,
        (pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')) AT TIME ZONE 'Asia/Jakarta'
    );

    -- 1. Top-up All-Time (order berhasil / settlement)
    SELECT
        pg_catalog.count(*),
        COALESCE(pg_catalog.sum(coins), 0),
        COALESCE(pg_catalog.sum(amount_rupiah), 0)
    INTO
        v_all_orders,
        v_all_coins,
        v_all_rupiah
    FROM public.topup_orders
    WHERE status = 'settlement'::public.payment_status;

    -- 2. Top-up Today (sejak 00:00 WIB hari ini)
    SELECT
        pg_catalog.count(*),
        COALESCE(pg_catalog.sum(coins), 0),
        COALESCE(pg_catalog.sum(amount_rupiah), 0)
    INTO
        v_today_orders,
        v_today_coins,
        v_today_rupiah
    FROM public.topup_orders
    WHERE status = 'settlement'::public.payment_status
      AND COALESCE(settled_at, created_at) >= v_today_start;

    -- 3. Payout Requested (antrean penarikan dana mitra)
    -- status adalah TEXT, bukan enum
    SELECT
        pg_catalog.count(*),
        COALESCE(pg_catalog.sum(amount_rupiah), 0)
    INTO
        v_payout_requested_count,
        v_payout_requested_rupiah
    FROM public.payout_requests
    WHERE status = 'requested';

    -- 4. Total Platform Revenue dari ledger_entries (account = 'platform_revenue')
    SELECT
        COALESCE(pg_catalog.sum(amount), 0)
    INTO
        v_platform_rev
    FROM public.ledger_entries
    WHERE account = 'platform_revenue';

    -- 5. Breakdown pendapatan platform per reason (tip_platform_share, payout_fee, dll.)
    SELECT
        COALESCE(
            jsonb_object_agg(sub.reason, sub.total_amount),
            '{}'::jsonb
        )
    INTO
        v_rev_breakdown
    FROM (
        SELECT reason, pg_catalog.sum(amount) AS total_amount
        FROM public.ledger_entries
        WHERE account = 'platform_revenue'
        GROUP BY reason
    ) sub;

    RETURN jsonb_build_object(
        'topup', jsonb_build_object(
            'all_time', jsonb_build_object(
                'total_orders', v_all_orders,
                'total_coins', v_all_coins,
                'total_rupiah', v_all_rupiah
            ),
            'today', jsonb_build_object(
                'total_orders', v_today_orders,
                'total_coins', v_today_coins,
                'total_rupiah', v_today_rupiah
            )
        ),
        'payout', jsonb_build_object(
            'requested_count', v_payout_requested_count,
            'total_requested_rupiah', v_payout_requested_rupiah
        ),
        'revenue', jsonb_build_object(
            'total_platform_revenue_rupiah', v_platform_rev,
            'breakdown_by_reason', v_rev_breakdown
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(TIMESTAMPTZ) TO service_role;


-- ========================================================
-- INSERT TEST FIXTURES
-- ========================================================

-- A. Topup orders:
-- 1. Settlement 2 hari lalu (all-time, bukan today)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
VALUES ('TOPUP-STATS-OLD-001', 'a1000000-0000-0000-0000-000000000001', 50, 500000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '2 days', pg_catalog.now() - INTERVAL '2 days');

-- 2. Settlement 1 jam lalu (all-time dan today)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
VALUES ('TOPUP-STATS-TODAY-002', 'a1000000-0000-0000-0000-000000000001', 20, 200000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '1 hour', pg_catalog.now() - INTERVAL '1 hour');

-- 3. Pending (tidak boleh masuk hitungan settlement)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at)
VALUES ('TOPUP-STATS-PEND-003', 'a1000000-0000-0000-0000-000000000001', 30, 300000, 'pending'::public.payment_status, pg_catalog.now());

-- 4. Expire (tidak boleh masuk hitungan settlement)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at)
VALUES ('TOPUP-STATS-EXP-004', 'a1000000-0000-0000-0000-000000000001', 40, 400000, 'expire'::public.payment_status, pg_catalog.now());

-- B. Payout requests:
-- 1. Requested (antrean valid)
INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
VALUES (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 2000000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'requested');

-- 2. Paid (sudah dibayar, tidak boleh dihitung requested)
INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
VALUES (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 1500000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'paid');

-- 3. Rejected (ditolak, tidak boleh dihitung requested)
INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
VALUES (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 1000000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'rejected');

-- C. Ledger entries:
INSERT INTO public.ledger_entries (user_id, account, amount, unit, reason, ref_type, ref_id)
VALUES
    (NULL, 'platform_revenue', 10000, 'rupiah', 'tip_platform_share', 'tip', gen_random_uuid()),
    (NULL, 'platform_revenue', 6500, 'rupiah', 'payout_fee', 'payout', gen_random_uuid()),
    ('a1000000-0000-0000-0000-000000000001', 'patient_coins', 50, 'coin', 'topup_settled', 'topup_order', gen_random_uuid());


-- ========================================================
-- EKSEKUSI PENGUJIAN OTOMATIS: MEMANGGIL ADMIN_DASHBOARD_STATS()
-- ========================================================

DO $$
DECLARE
    v_res JSONB;
    v_all_orders BIGINT;
    v_all_coins BIGINT;
    v_all_rupiah BIGINT;
    v_today_orders BIGINT;
    v_today_coins BIGINT;
    v_today_rupiah BIGINT;
    v_payout_count BIGINT;
    v_payout_total BIGINT;
    v_rev BIGINT;
    v_tip_rev BIGINT;
    v_fee_rev BIGINT;
BEGIN
    -- Pemanggilan RPC fungsi
    v_res := public.admin_dashboard_stats();

    IF v_res IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: admin_dashboard_stats returned NULL';
    END IF;

    -- 1. Verifikasi Topup All-Time (2 orders, 70 coins, Rp 700.000)
    v_all_orders := (v_res->'topup'->'all_time'->>'total_orders')::BIGINT;
    v_all_coins := (v_res->'topup'->'all_time'->>'total_coins')::BIGINT;
    v_all_rupiah := (v_res->'topup'->'all_time'->>'total_rupiah')::BIGINT;

    IF v_all_orders <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time total_orders mismatch, expected 2 got %', v_all_orders;
    END IF;
    IF v_all_coins <> 70 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time total_coins mismatch, expected 70 got %', v_all_coins;
    END IF;
    IF v_all_rupiah <> 700000 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time total_rupiah mismatch, expected 700000 got %', v_all_rupiah;
    END IF;

    -- 2. Verifikasi Topup Today (1 order, 20 coins, Rp 200.000)
    v_today_orders := (v_res->'topup'->'today'->>'total_orders')::BIGINT;
    v_today_coins := (v_res->'topup'->'today'->>'total_coins')::BIGINT;
    v_today_rupiah := (v_res->'topup'->'today'->>'total_rupiah')::BIGINT;

    IF v_today_orders <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: today total_orders mismatch, expected 1 got %', v_today_orders;
    END IF;
    IF v_today_coins <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: today total_coins mismatch, expected 20 got %', v_today_coins;
    END IF;
    IF v_today_rupiah <> 200000 THEN
        RAISE EXCEPTION 'TEST FAILED: today total_rupiah mismatch, expected 200000 got %', v_today_rupiah;
    END IF;

    -- 3. Verifikasi Payout Requested (1 order, Rp 2.000.000)
    v_payout_count := (v_res->'payout'->>'requested_count')::BIGINT;
    v_payout_total := (v_res->'payout'->>'total_requested_rupiah')::BIGINT;

    IF v_payout_count <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: payout requested_count mismatch, expected 1 got %', v_payout_count;
    END IF;
    IF v_payout_total <> 2000000 THEN
        RAISE EXCEPTION 'TEST FAILED: payout total_requested_rupiah mismatch, expected 2000000 got %', v_payout_total;
    END IF;

    -- 4. Verifikasi Platform Revenue (10.000 + 6.500 = 16.500)
    v_rev := (v_res->'revenue'->>'total_platform_revenue_rupiah')::BIGINT;
    IF v_rev <> 16500 THEN
        RAISE EXCEPTION 'TEST FAILED: total_platform_revenue_rupiah mismatch, expected 16500 got %', v_rev;
    END IF;

    -- 5. Verifikasi Breakdown Reason
    v_tip_rev := (v_res->'revenue'->'breakdown_by_reason'->>'tip_platform_share')::BIGINT;
    v_fee_rev := (v_res->'revenue'->'breakdown_by_reason'->>'payout_fee')::BIGINT;

    IF v_tip_rev <> 10000 THEN
        RAISE EXCEPTION 'TEST FAILED: tip_platform_share mismatch, expected 10000 got %', v_tip_rev;
    END IF;
    IF v_fee_rev <> 6500 THEN
        RAISE EXCEPTION 'TEST FAILED: payout_fee mismatch, expected 6500 got %', v_fee_rev;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK (DATABASE TETAP BERSIH)
-- ========================================================
SELECT 'SEMUA PENGUJIAN ADMIN_DASHBOARD_STATS() LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
