-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 20261111000029 (ACTIVE ADMIN ONLY)
-- Path: supabase/tests/active_admin_only_dryrun.sql
-- Scope:
-- 1. DDL Salinan persis dari 20261111000029_active_admin_only.sql
-- 2. Setup fixture dinamis & terisolasi (UUID acak, tanpa menimpa data dev eksis)
-- 3. Uji 1: Admin berstatus active -> public.is_admin() = true
-- 4. Uji 2: Admin berstatus suspended -> public.is_admin() = false
-- 5. Uji 3: Admin berstatus rejected -> public.is_admin() = false
-- 6. Uji 4: Admin berstatus pending_approval -> public.is_admin() = false
-- 7. Uji 5: Non-admin (pasien active) -> public.is_admin() = false
-- 8. Uji 6: Tanpa sesi autentikasi (auth.uid() NULL) -> public.is_admin() = false
-- 9. Uji 7: Transisi status admin active -> suspended -> active mengubah hasil public.is_admin()
-- 10. Uji 8: Verifikasi SECURITY DEFINER, search_path kosong, dan hak akses REVOKE/GRANT
-- 11. Penanda DRYRUN_OK dan ROLLBACK
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. DDL SALINAN PERSIS DARI 20261111000029_active_admin_only.sql
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND role = 'admin'::public.user_role
          AND status = 'active'::public.account_status
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_admin() IS 'Helper RLS non-rekursif untuk verifikasi apakah pemanggil memiliki role admin dengan status akun active';

-- ========================================================
-- 2. EKSEKUSI PENGUJIAN DENGAN FIXTURE DINAMIS TERISOLASI
-- ========================================================

DO $$
DECLARE
    v_admin_active_id UUID := gen_random_uuid();
    v_admin_suspended_id UUID := gen_random_uuid();
    v_admin_rejected_id UUID := gen_random_uuid();
    v_admin_pending_id UUID := gen_random_uuid();
    v_pasien_active_id UUID := gen_random_uuid();
BEGIN
    -- Setup auth.users dinamis
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES
        (v_admin_active_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'adm_act_' || replace(v_admin_active_id::text, '-', '') || '@temanbicara.test',
         '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_admin_suspended_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'adm_sus_' || replace(v_admin_suspended_id::text, '-', '') || '@temanbicara.test',
         '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_admin_rejected_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'adm_rej_' || replace(v_admin_rejected_id::text, '-', '') || '@temanbicara.test',
         '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_admin_pending_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'adm_pen_' || replace(v_admin_pending_id::text, '-', '') || '@temanbicara.test',
         '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_pasien_active_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'pas_act_' || replace(v_pasien_active_id::text, '-', '') || '@temanbicara.test',
         '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

    -- Setup public.users dinamis
    INSERT INTO public.users (id, email, no_wa, role, status)
    VALUES
        (v_admin_active_id, 'adm_act_' || replace(v_admin_active_id::text, '-', '') || '@temanbicara.test',
         '08' || substr(replace(replace(v_admin_active_id::text, '-', ''), 'a', '1'), 1, 10),
         'admin'::public.user_role, 'active'::public.account_status),
        (v_admin_suspended_id, 'adm_sus_' || replace(v_admin_suspended_id::text, '-', '') || '@temanbicara.test',
         '08' || substr(replace(replace(v_admin_suspended_id::text, '-', ''), 'b', '2'), 1, 10),
         'admin'::public.user_role, 'suspended'::public.account_status),
        (v_admin_rejected_id, 'adm_rej_' || replace(v_admin_rejected_id::text, '-', '') || '@temanbicara.test',
         '08' || substr(replace(replace(v_admin_rejected_id::text, '-', ''), 'c', '3'), 1, 10),
         'admin'::public.user_role, 'rejected'::public.account_status),
        (v_admin_pending_id, 'adm_pen_' || replace(v_admin_pending_id::text, '-', '') || '@temanbicara.test',
         '08' || substr(replace(replace(v_admin_pending_id::text, '-', ''), 'd', '4'), 1, 10),
         'admin'::public.user_role, 'pending_approval'::public.account_status),
        (v_pasien_active_id, 'pas_act_' || replace(v_pasien_active_id::text, '-', '') || '@temanbicara.test',
         '08' || substr(replace(replace(v_pasien_active_id::text, '-', ''), 'e', '5'), 1, 10),
         'pasien'::public.user_role, 'active'::public.account_status);

    -- ----------------------------------------------------
    -- UJI 1: Admin berstatus active -> is_admin() = true
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_admin_active_id::text, 'role', 'authenticated')::text,
        true
    );
    ASSERT public.is_admin() = true,
        'UJI 1 GAGAL: public.is_admin() harus true untuk admin berstatus active';

    -- ----------------------------------------------------
    -- UJI 2: Admin berstatus suspended -> is_admin() = false
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_admin_suspended_id::text, 'role', 'authenticated')::text,
        true
    );
    ASSERT public.is_admin() = false,
        'UJI 2 GAGAL: public.is_admin() harus false untuk admin berstatus suspended';

    -- ----------------------------------------------------
    -- UJI 3: Admin berstatus rejected -> is_admin() = false
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_admin_rejected_id::text, 'role', 'authenticated')::text,
        true
    );
    ASSERT public.is_admin() = false,
        'UJI 3 GAGAL: public.is_admin() harus false untuk admin berstatus rejected';

    -- ----------------------------------------------------
    -- UJI 4: Admin berstatus pending_approval -> is_admin() = false
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_admin_pending_id::text, 'role', 'authenticated')::text,
        true
    );
    ASSERT public.is_admin() = false,
        'UJI 4 GAGAL: public.is_admin() harus false untuk admin berstatus pending_approval';

    -- ----------------------------------------------------
    -- UJI 5: Non-admin (pasien active) -> is_admin() = false
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_pasien_active_id::text, 'role', 'authenticated')::text,
        true
    );
    ASSERT public.is_admin() = false,
        'UJI 5 GAGAL: public.is_admin() harus false untuk pengguna non-admin';

    -- ----------------------------------------------------
    -- UJI 6: Tanpa klaim JWT (auth.uid() NULL) -> is_admin() = false
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config('request.jwt.claims', '', true);
    ASSERT public.is_admin() = false,
        'UJI 6 GAGAL: public.is_admin() harus false saat auth.uid() bernilai NULL';

    -- ----------------------------------------------------
    -- UJI 7: Transisi status admin active -> suspended mencabut hak is_admin()
    -- ----------------------------------------------------
    PERFORM pg_catalog.set_config(
        'request.jwt.claims',
        pg_catalog.json_build_object('sub', v_admin_active_id::text, 'role', 'authenticated')::text,
        true
    );
    UPDATE public.users
    SET status = 'suspended'::public.account_status
    WHERE id = v_admin_active_id;

    ASSERT public.is_admin() = false,
        'UJI 7a GAGAL: public.is_admin() harus langsung false setelah status admin diubah ke suspended';

    UPDATE public.users
    SET status = 'active'::public.account_status
    WHERE id = v_admin_active_id;

    ASSERT public.is_admin() = true,
        'UJI 7b GAGAL: public.is_admin() harus kembali true setelah status admin dikembalikan ke active';

    -- ----------------------------------------------------
    -- UJI 8: Verifikasi SECURITY DEFINER, search_path, dan privilege EXECUTE
    -- ----------------------------------------------------
    PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin'
      AND p.prosecdef = true
      AND array_to_string(p.proconfig, ',') LIKE '%search_path=%';

    ASSERT FOUND, 'UJI 8a GAGAL: public.is_admin() harus SECURITY DEFINER dengan search_path eksplisit';

    ASSERT has_function_privilege('public', 'public.is_admin()', 'EXECUTE') = false,
        'UJI 8b GAGAL: PUBLIC dilarang memiliki hak EXECUTE pada public.is_admin()';
    ASSERT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') = false,
        'UJI 8c GAGAL: anon dilarang memiliki hak EXECUTE pada public.is_admin()';
    ASSERT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') = true,
        'UJI 8d GAGAL: authenticated wajib memiliki hak EXECUTE pada public.is_admin()';
    ASSERT has_function_privilege('service_role', 'public.is_admin()', 'EXECUTE') = true,
        'UJI 8e GAGAL: service_role wajib memiliki hak EXECUTE pada public.is_admin()';

    PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
    LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin'
      AND a.privilege_type = 'EXECUTE'
      AND a.grantee IN (0::oid, 'anon'::regrole::oid);

    ASSERT NOT FOUND, 'UJI 8f GAGAL: Entri ACL EXECUTE untuk PUBLIC/anon ditemukan pada pg_proc.proacl';
END $$;

-- ========================================================
-- NOTIFIKASI KELULUSAN & TRANSAKSI ROLLBACK
-- ========================================================

DO $$
BEGIN
    RAISE NOTICE 'DRYRUN_OK';
END $$;

ROLLBACK;
