-- Dry-run PRD-055: jalankan SETELAH isi migrasi 20261118000036 dalam satu transaksi.
-- Berakhir dengan RAISE EXCEPTION 'DRYRUN_OK' agar seluruh transaksi dibatalkan.
DO $$
DECLARE
    v_id UUID;
    v_ok BOOLEAN;
BEGIN
    -- 1. Insert valid
    INSERT INTO public.activity_logs (actor_id, actor_role, category, action, target_type, target_id, metadata)
    VALUES (pg_catalog.gen_random_uuid(), 'admin', 'admin', 'payout.paid', 'payout_request', 'x', '{"amount_rupiah": 500000}')
    RETURNING id INTO v_id;

    -- 2. UPDATE ditolak
    v_ok := false;
    BEGIN
        UPDATE public.activity_logs SET action = 'payout.rejected' WHERE id = v_id;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: UPDATE lolos'; END IF;

    -- 3. DELETE ditolak
    v_ok := false;
    BEGIN
        DELETE FROM public.activity_logs WHERE id = v_id;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: DELETE lolos'; END IF;

    -- 4. Format action, role, kategori, dan ukuran metadata ditegakkan
    v_ok := false;
    BEGIN
        INSERT INTO public.activity_logs (actor_role, category, action) VALUES ('admin', 'admin', 'Bukan Format');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: action bebas lolos'; END IF;

    v_ok := false;
    BEGIN
        INSERT INTO public.activity_logs (actor_role, category, action) VALUES ('hacker', 'admin', 'user.updated');
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: actor_role bebas lolos'; END IF;

    v_ok := false;
    BEGIN
        INSERT INTO public.activity_logs (actor_role, category, action, metadata)
        VALUES ('system', 'money', 'topup.settled', pg_catalog.jsonb_build_object('x', pg_catalog.repeat('a', 5000)));
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: metadata besar lolos'; END IF;

    -- 5. Hak akses: service_role hanya SELECT+INSERT, anon/authenticated tidak punya akses
    IF NOT pg_catalog.has_table_privilege('service_role', 'public.activity_logs', 'INSERT')
       OR NOT pg_catalog.has_table_privilege('service_role', 'public.activity_logs', 'SELECT') THEN
        RAISE EXCEPTION 'GAGAL: service_role tidak bisa SELECT/INSERT';
    END IF;
    IF pg_catalog.has_table_privilege('service_role', 'public.activity_logs', 'UPDATE')
       OR pg_catalog.has_table_privilege('service_role', 'public.activity_logs', 'DELETE') THEN
        RAISE EXCEPTION 'GAGAL: service_role punya UPDATE/DELETE';
    END IF;
    IF pg_catalog.has_table_privilege('anon', 'public.activity_logs', 'SELECT')
       OR pg_catalog.has_table_privilege('authenticated', 'public.activity_logs', 'SELECT') THEN
        RAISE EXCEPTION 'GAGAL: anon/authenticated bisa membaca log';
    END IF;

    RAISE EXCEPTION 'DRYRUN_OK';
END;
$$;
