-- ========================================================
-- TEMAN BICARA: RPC TOPUP_ATTACH_SNAP (FASE 2 TAMBAHAN)
-- Eksekusi file ini di: Supabase Dashboard / CLI
-- Scope:
-- 1. RPC topup_attach_snap untuk menyimpan snap_redirect_url secara aman
--    karena direct UPDATE pada tabel topup_orders di-REVOKE dari semua role (termasuk service_role).
-- Semua SECURITY DEFINER memakai search_path = '' dan nama objek fully qualified.
-- ========================================================

BEGIN;

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

COMMIT;
