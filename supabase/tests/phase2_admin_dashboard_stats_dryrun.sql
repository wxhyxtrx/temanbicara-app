-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST RPC ADMIN_DASHBOARD_STATS (POLA SELISIH / DELTA)
-- Path: supabase/tests/admin_stats_dryrun.sql
-- Scope:
-- 1. DDL public.admin_dashboard_stats() persis dari migrasi 000006
-- 2. Panggil sebelum fixture -> simpan baseline
-- 3. Insert fixture
-- 4. Panggil lagi -> assert hasil = baseline + kontribusi fixture
--    (all_time +2 order / +70 koin / +700.000; today +1 / +20 / +200.000;
--     payout requested +1 / +2.000.000; revenue +16.500;
--     breakdown tip +10.000, payout_fee +6.500)
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
-- EKSEKUSI PENGUJIAN OTOMATIS: POLA SELISIH (DELTA)
-- ========================================================

DO $$
DECLARE
    v_base JSONB;
    v_after JSONB;

    -- Baseline vars
    v_b_all_orders BIGINT;
    v_b_all_coins BIGINT;
    v_b_all_rupiah BIGINT;
    v_b_today_orders BIGINT;
    v_b_today_coins BIGINT;
    v_b_today_rupiah BIGINT;
    v_b_payout_count BIGINT;
    v_b_payout_total BIGINT;
    v_b_rev BIGINT;
    v_b_tip_rev BIGINT;
    v_b_fee_rev BIGINT;

    -- After vars
    v_a_all_orders BIGINT;
    v_a_all_coins BIGINT;
    v_a_all_rupiah BIGINT;
    v_a_today_orders BIGINT;
    v_a_today_coins BIGINT;
    v_a_today_rupiah BIGINT;
    v_a_payout_count BIGINT;
    v_a_payout_total BIGINT;
    v_a_rev BIGINT;
    v_a_tip_rev BIGINT;
    v_a_fee_rev BIGINT;
BEGIN
    -- 1. PANGGIL SEBELUM INSERT FIXTURE (SIMPAN BASELINE DARI DATA DB EKSISTING)
    v_base := public.admin_dashboard_stats();

    IF v_base IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: admin_dashboard_stats returned NULL on baseline';
    END IF;

    v_b_all_orders := COALESCE((v_base->'topup'->'all_time'->>'total_orders')::BIGINT, 0);
    v_b_all_coins := COALESCE((v_base->'topup'->'all_time'->>'total_coins')::BIGINT, 0);
    v_b_all_rupiah := COALESCE((v_base->'topup'->'all_time'->>'total_rupiah')::BIGINT, 0);

    v_b_today_orders := COALESCE((v_base->'topup'->'today'->>'total_orders')::BIGINT, 0);
    v_b_today_coins := COALESCE((v_base->'topup'->'today'->>'total_coins')::BIGINT, 0);
    v_b_today_rupiah := COALESCE((v_base->'topup'->'today'->>'total_rupiah')::BIGINT, 0);

    v_b_payout_count := COALESCE((v_base->'payout'->>'requested_count')::BIGINT, 0);
    v_b_payout_total := COALESCE((v_base->'payout'->>'total_requested_rupiah')::BIGINT, 0);

    v_b_rev := COALESCE((v_base->'revenue'->>'total_platform_revenue_rupiah')::BIGINT, 0);
    v_b_tip_rev := COALESCE((v_base->'revenue'->'breakdown_by_reason'->>'tip_platform_share')::BIGINT, 0);
    v_b_fee_rev := COALESCE((v_base->'revenue'->'breakdown_by_reason'->>'payout_fee')::BIGINT, 0);

    -- 2. INSERT TEST FIXTURES
    -- A. Topup orders:
    -- 1) Settlement 2 hari lalu (all-time +1, today +0)
    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
    VALUES ('TOPUP-DRYRUN-OLD-' || pg_catalog.gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 50, 500000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '2 days', pg_catalog.now() - INTERVAL '2 days');

    -- 2) Settlement 1 jam lalu (all-time +1, today +1)
    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
    VALUES ('TOPUP-DRYRUN-TODAY-' || pg_catalog.gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 20, 200000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '1 hour', pg_catalog.now() - INTERVAL '1 hour');

    -- 3) Pending (all-time +0, today +0)
    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at)
    VALUES ('TOPUP-DRYRUN-PEND-' || pg_catalog.gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 30, 300000, 'pending'::public.payment_status, pg_catalog.now());

    -- 4) Expire (all-time +0, today +0)
    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at)
    VALUES ('TOPUP-DRYRUN-EXP-' || pg_catalog.gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 40, 400000, 'expire'::public.payment_status, pg_catalog.now());

    -- B. Payout requests:
    -- 1) Requested (+1 count, +2.000.000 rupiah)
    INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
    VALUES (pg_catalog.gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 2000000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'requested');

    -- 2) Paid (+0 requested)
    INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
    VALUES (pg_catalog.gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 1500000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'paid');

    -- 3) Rejected (+0 requested)
    INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
    VALUES (pg_catalog.gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 1000000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'rejected');

    -- C. Ledger entries:
    -- +10.000 tip_platform_share, +6.500 payout_fee
    INSERT INTO public.ledger_entries (user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES
        (NULL, 'platform_revenue', 10000, 'rupiah', 'tip_platform_share', 'tip', pg_catalog.gen_random_uuid()),
        (NULL, 'platform_revenue', 6500, 'rupiah', 'payout_fee', 'payout', pg_catalog.gen_random_uuid()),
        ('a1000000-0000-0000-0000-000000000001', 'patient_coins', 50, 'coin', 'topup_settled', 'topup_order', pg_catalog.gen_random_uuid());

    -- 3. PANGGIL KEMBALI SETELAH FIXTURE DI-INSERT
    v_after := public.admin_dashboard_stats();

    v_a_all_orders := COALESCE((v_after->'topup'->'all_time'->>'total_orders')::BIGINT, 0);
    v_a_all_coins := COALESCE((v_after->'topup'->'all_time'->>'total_coins')::BIGINT, 0);
    v_a_all_rupiah := COALESCE((v_after->'topup'->'all_time'->>'total_rupiah')::BIGINT, 0);

    v_a_today_orders := COALESCE((v_after->'topup'->'today'->>'total_orders')::BIGINT, 0);
    v_a_today_coins := COALESCE((v_after->'topup'->'today'->>'total_coins')::BIGINT, 0);
    v_a_today_rupiah := COALESCE((v_after->'topup'->'today'->>'total_rupiah')::BIGINT, 0);

    v_a_payout_count := COALESCE((v_after->'payout'->>'requested_count')::BIGINT, 0);
    v_a_payout_total := COALESCE((v_after->'payout'->>'total_requested_rupiah')::BIGINT, 0);

    v_a_rev := COALESCE((v_after->'revenue'->>'total_platform_revenue_rupiah')::BIGINT, 0);
    v_a_tip_rev := COALESCE((v_after->'revenue'->'breakdown_by_reason'->>'tip_platform_share')::BIGINT, 0);
    v_a_fee_rev := COALESCE((v_after->'revenue'->'breakdown_by_reason'->>'payout_fee')::BIGINT, 0);

    -- 4. ASSERT POLA SELISIH (DELTA TEST)
    -- Topup All-Time delta: +2 orders, +70 coins, +700.000 rupiah
    IF v_a_all_orders - v_b_all_orders <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time orders delta mismatch, expected +2 got % (base: %, after: %)',
            v_a_all_orders - v_b_all_orders, v_b_all_orders, v_a_all_orders;
    END IF;
    IF v_a_all_coins - v_b_all_coins <> 70 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time coins delta mismatch, expected +70 got % (base: %, after: %)',
            v_a_all_coins - v_b_all_coins, v_b_all_coins, v_a_all_coins;
    END IF;
    IF v_a_all_rupiah - v_b_all_rupiah <> 700000 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time rupiah delta mismatch, expected +700000 got % (base: %, after: %)',
            v_a_all_rupiah - v_b_all_rupiah, v_b_all_rupiah, v_a_all_rupiah;
    END IF;

    -- Topup Today delta: +1 order, +20 coins, +200.000 rupiah
    IF v_a_today_orders - v_b_today_orders <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: today orders delta mismatch, expected +1 got % (base: %, after: %)',
            v_a_today_orders - v_b_today_orders, v_b_today_orders, v_a_today_orders;
    END IF;
    IF v_a_today_coins - v_b_today_coins <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: today coins delta mismatch, expected +20 got % (base: %, after: %)',
            v_a_today_coins - v_b_today_coins, v_b_today_coins, v_a_today_coins;
    END IF;
    IF v_a_today_rupiah - v_b_today_rupiah <> 200000 THEN
        RAISE EXCEPTION 'TEST FAILED: today rupiah delta mismatch, expected +200000 got % (base: %, after: %)',
            v_a_today_rupiah - v_b_today_rupiah, v_b_today_rupiah, v_a_today_rupiah;
    END IF;

    -- Payout Requested delta: +1 count, +2.000.000 rupiah
    IF v_a_payout_count - v_b_payout_count <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: payout requested_count delta mismatch, expected +1 got % (base: %, after: %)',
            v_a_payout_count - v_b_payout_count, v_b_payout_count, v_a_payout_count;
    END IF;
    IF v_a_payout_total - v_b_payout_total <> 2000000 THEN
        RAISE EXCEPTION 'TEST FAILED: payout total_requested_rupiah delta mismatch, expected +2000000 got % (base: %, after: %)',
            v_a_payout_total - v_b_payout_total, v_b_payout_total, v_a_payout_total;
    END IF;

    -- Platform Revenue delta: +16.500 rupiah
    IF v_a_rev - v_b_rev <> 16500 THEN
        RAISE EXCEPTION 'TEST FAILED: platform revenue delta mismatch, expected +16500 got % (base: %, after: %)',
            v_a_rev - v_b_rev, v_b_rev, v_a_rev;
    END IF;

    -- Breakdown delta: tip_platform_share +10.000, payout_fee +6.500
    IF v_a_tip_rev - v_b_tip_rev <> 10000 THEN
        RAISE EXCEPTION 'TEST FAILED: tip_platform_share delta mismatch, expected +10000 got % (base: %, after: %)',
            v_a_tip_rev - v_b_tip_rev, v_b_tip_rev, v_a_tip_rev;
    END IF;
    IF v_a_fee_rev - v_b_fee_rev <> 6500 THEN
        RAISE EXCEPTION 'TEST FAILED: payout_fee delta mismatch, expected +6500 got % (base: %, after: %)',
            v_a_fee_rev - v_b_fee_rev, v_b_fee_rev, v_a_fee_rev;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK (DATABASE TETAP BERSIH)
-- ========================================================
SELECT 'SEMUA PENGUJIAN ADMIN_DASHBOARD_STATS() POLA SELISIH LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
