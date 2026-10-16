-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST RPC ADMIN_DASHBOARD_STATS
-- Scope:
-- 1. Fungsi public.admin_dashboard_stats()
-- 2. Uji hitung top-up all-time vs today (WIB)
-- 3. Uji antrean payout requested (jumlah & total nominal)
-- 4. Uji total platform_revenue dan breakdown reason dari ledger_entries
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users (to satisfy users_id_fkey)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_stats_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dryrun_stats_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users & wallets
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'dryrun_stats_pasien@temanbicara.test', '081111110001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000002', 'dryrun_stats_psikolog@temanbicara.test', '081111110002', 'psikolog'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 100, 0, 0),
    ('a2000000-0000-0000-0000-000000000002', 0, 0, 5000000)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = EXCLUDED.coin_balance;

-- 3. DDL FUNGSI ADMIN_DASHBOARD_STATS
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
    v_today_start := COALESCE(
        p_today_start,
        (pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')) AT TIME ZONE 'Asia/Jakarta'
    );

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

    SELECT
        pg_catalog.count(*),
        COALESCE(pg_catalog.sum(amount_rupiah), 0)
    INTO
        v_payout_requested_count,
        v_payout_requested_rupiah
    FROM public.payout_requests
    WHERE status = 'requested'::public.payout_status;

    SELECT
        COALESCE(pg_catalog.sum(amount), 0)
    INTO
        v_platform_rev
    FROM public.ledger_entries
    WHERE account = 'platform_revenue';

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

-- 4. INSERT TEST FIXTURES
-- A. Topup orders:
-- 1. Settlement kemarin (all-time, bukan today)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
VALUES ('TOPUP-STATS-OLD-001', 'a1000000-0000-0000-0000-000000000001', 50, 500000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '2 days', pg_catalog.now() - INTERVAL '2 days');

-- 2. Settlement hari ini (all-time dan today)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at, settled_at)
VALUES ('TOPUP-STATS-TODAY-002', 'a1000000-0000-0000-0000-000000000001', 20, 200000, 'settlement'::public.payment_status, pg_catalog.now() - INTERVAL '1 hour', pg_catalog.now() - INTERVAL '1 hour');

-- 3. Pending (tidak boleh masuk hitungan settlement)
INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status, created_at)
VALUES ('TOPUP-STATS-PEND-003', 'a1000000-0000-0000-0000-000000000001', 30, 300000, 'pending'::public.payment_status, pg_catalog.now());

-- B. Payout requests:
-- 1. Requested (antrean)
INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
VALUES (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 2000000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'requested'::public.payout_status);

-- 2. Paid (sudah dibayar, tidak masuk requested)
INSERT INTO public.payout_requests (id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status)
VALUES (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000002', 1500000, 6500, 'BCA', '1234567890', 'Dr. Dryrun', 'paid'::public.payout_status);

-- C. Ledger entries:
INSERT INTO public.ledger_entries (user_id, account, amount, unit, reason, ref_type, ref_id)
VALUES
    (NULL, 'platform_revenue', 10000, 'rupiah', 'tip_platform_share', 'tip', gen_random_uuid()),
    (NULL, 'platform_revenue', 6500, 'rupiah', 'payout_fee', 'payout', gen_random_uuid()),
    ('a1000000-0000-0000-0000-000000000001', 'patient_coins', 50, 'coin', 'topup_settled', 'topup_order', gen_random_uuid());


-- ========================================================
-- EKSEKUSI PENGUJIAN OTOMATIS
-- ========================================================

DO $$
DECLARE
    v_res JSONB;
    v_all_coins BIGINT;
    v_today_coins BIGINT;
    v_payout_count BIGINT;
    v_rev BIGINT;
    v_tip_rev BIGINT;
BEGIN
    v_res := public.admin_dashboard_stats();

    -- Verifikasi all-time coins (50 + 20 = 70)
    v_all_coins := (v_res->'topup'->'all_time'->>'total_coins')::BIGINT;
    IF v_all_coins <> 70 THEN
        RAISE EXCEPTION 'TEST FAILED: all_time total_coins mismatch, expected 70 got %', v_all_coins;
    END IF;

    -- Verifikasi today coins (20)
    v_today_coins := (v_res->'topup'->'today'->>'total_coins')::BIGINT;
    IF v_today_coins <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: today total_coins mismatch, expected 20 got %', v_today_coins;
    END IF;

    -- Verifikasi payout requested (1 request, Rp 2.000.000)
    v_payout_count := (v_res->'payout'->>'requested_count')::BIGINT;
    IF v_payout_count <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: payout requested_count mismatch, expected 1 got %', v_payout_count;
    END IF;

    -- Verifikasi platform revenue (10.000 + 6.500 = 16.500)
    v_rev := (v_res->'revenue'->>'total_platform_revenue_rupiah')::BIGINT;
    IF v_rev <> 16500 THEN
        RAISE EXCEPTION 'TEST FAILED: total_platform_revenue_rupiah mismatch, expected 16500 got %', v_rev;
    END IF;

    -- Verifikasi breakdown
    v_tip_rev := (v_res->'revenue'->'breakdown_by_reason'->>'tip_platform_share')::BIGINT;
    IF v_tip_rev <> 10000 THEN
        RAISE EXCEPTION 'TEST FAILED: tip_platform_share mismatch, expected 10000 got %', v_tip_rev;
    END IF;
END;
$$;

SELECT 'SEMUA TEST ADMIN_DASHBOARD_STATS LULUS DENGAN AMAN' AS hasil;

ROLLBACK;
