-- ========================================================
-- TEMAN BICARA: RPC ADMIN DASHBOARD STATS (FASE 2 TAMBAHAN)
-- Eksekusi file ini di: Supabase Dashboard / CLI
-- Scope:
-- 1. Fungsi baca-saja public.admin_dashboard_stats() untuk agregasi finansial dashboard admin:
--    - Top-up all-time & today (sejak 00:00 WIB / Asia/Jakarta)
--    - Payout requests pending/requested (jumlah & total nominal rupiah)
--    - Total pendapatan platform dari ledger_entries (account = 'platform_revenue') beserta breakdown reason
-- Semua SECURITY DEFINER memakai search_path = '' dan nama objek fully qualified.
-- ========================================================

BEGIN;

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
    SELECT
        pg_catalog.count(*),
        COALESCE(pg_catalog.sum(amount_rupiah), 0)
    INTO
        v_payout_requested_count,
        v_payout_requested_rupiah
    FROM public.payout_requests
    WHERE status = 'requested'::public.payout_status;

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

COMMIT;
