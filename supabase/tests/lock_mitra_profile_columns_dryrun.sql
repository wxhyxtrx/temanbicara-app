-- T-199: jalankan pada DB uji dengan migrasi 29; seluruh fixture di-rollback.
-- DDL migrasi 30 disalin setelah snapshot ACL, sebelum blok pemeriksaan.
BEGIN;

CREATE TEMP TABLE t199_service_acl ON COMMIT DROP AS
SELECT t, p, has_table_privilege('service_role', t, p) AS allowed
FROM unnest(ARRAY['public.psikolog_profiles', 'public.relawan_profiles']) AS t
CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p;

-- Salinan DDL migrasi 20261111000030_lock_mitra_profile_columns.sql.
-- T-199 / PRD-047: batasi kolom profil dan seragamkan cek admin aktif.
-- Tidak mengubah grant service_role maupun klausa akses non-admin.
REVOKE SELECT ON public.psikolog_profiles, public.relawan_profiles FROM anon;
REVOKE SELECT ON public.psikolog_profiles FROM authenticated;
-- Bersihkan juga grant kolom sensitif lama; grant tabel saja tidak cukup.
REVOKE SELECT (dokumen_sipp_str_url, nomor_sipp_str, saldo, rejection_reason, suspended_until)
    ON public.psikolog_profiles FROM authenticated;
GRANT SELECT (
    user_id, nama_lengkap_gelar, spesialisasi, tahun_pengalaman, tarif_sesi,
    verified_at, created_at, updated_at, booking_paused, extension_price_coins
) ON public.psikolog_profiles TO authenticated;

DROP POLICY IF EXISTS "Public read approved psikolog" ON public.psikolog_profiles;
CREATE POLICY "Public read approved psikolog"
ON public.psikolog_profiles FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = user_id AND users.status = 'active')
    OR auth.uid() = user_id
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admin manage relawan" ON public.relawan_profiles;
CREATE POLICY "Admin manage relawan"
ON public.relawan_profiles FOR ALL
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only read system_settings" ON public.system_settings;
CREATE POLICY "Admin only read system_settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only read system_settings_audit" ON public.system_settings_audit;
CREATE POLICY "Admin only read system_settings_audit"
ON public.system_settings_audit FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Mitra and admin view docs" ON storage.objects;
CREATE POLICY "Mitra and admin view docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'dokumen-mitra' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    )
);

DO $test$
DECLARE
    col text;
    pol record;
    fixture_id uuid := gen_random_uuid();
    admin_id uuid := gen_random_uuid();
    target_id uuid := gen_random_uuid();
    fixture_key text;
BEGIN
    FOREACH col IN ARRAY ARRAY['dokumen_sipp_str_url','nomor_sipp_str','saldo','rejection_reason','suspended_until'] LOOP
        ASSERT NOT has_column_privilege('authenticated', 'public.psikolog_profiles', col, 'SELECT'),
            'Kolom sensitif masih terbaca: ' || col;
    END LOOP;
    FOR col IN
        SELECT attname FROM pg_attribute
        WHERE attrelid = 'public.psikolog_profiles'::regclass AND attnum > 0 AND NOT attisdropped
          AND attname <> ALL (ARRAY['dokumen_sipp_str_url','nomor_sipp_str','saldo','rejection_reason','suspended_until'])
    LOOP
        ASSERT has_column_privilege('authenticated', 'public.psikolog_profiles', col, 'SELECT'),
            'Kolom publik tidak terbaca: ' || col;
    END LOOP;
    ASSERT NOT has_table_privilege('authenticated', 'public.psikolog_profiles', 'SELECT'), 'Grant tabel authenticated masih ada';
    ASSERT NOT has_table_privilege('anon', 'public.psikolog_profiles', 'SELECT'), 'Anon membaca psikolog';
    ASSERT NOT has_table_privilege('anon', 'public.relawan_profiles', 'SELECT'), 'Anon membaca relawan';
    ASSERT NOT EXISTS (
        SELECT 1 FROM t199_service_acl WHERE allowed IS DISTINCT FROM has_table_privilege('service_role', t, p)
    ), 'Grant service_role berubah';

    FOR pol IN SELECT * FROM (VALUES
        ('public','psikolog_profiles','Public read approved psikolog','SELECT'),
        ('public','relawan_profiles','Admin manage relawan','ALL'),
        ('public','system_settings','Admin only read system_settings','SELECT'),
        ('public','system_settings_audit','Admin only read system_settings_audit','SELECT'),
        ('storage','objects','Mitra and admin view docs','SELECT')
    ) AS expected(schema_name, table_name, policy_name, command)
    LOOP
        ASSERT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = pol.schema_name AND tablename = pol.table_name
              AND policyname = pol.policy_name AND cmd = pol.command
              AND roles = ARRAY['authenticated']::name[]
              AND qual LIKE '%is_admin()%'
              AND (with_check IS NULL OR with_check LIKE '%is_admin()%')
        ), 'Policy salah: ' || pol.policy_name;
    END LOOP;

    fixture_key := 't199_' || fixture_id::text;
    PERFORM set_config('t199.admin_id', admin_id::text, true);
    PERFORM set_config('t199.target_id', target_id::text, true);
    PERFORM set_config('t199.fixture_key', fixture_key, true);
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
        id::text || '@temanbicara.test', '', now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    FROM unnest(ARRAY[admin_id, target_id]) AS id;
    INSERT INTO public.users (id, email, role, status) VALUES
        (admin_id, admin_id::text || '@temanbicara.test', 'admin', 'suspended'),
        (target_id, target_id::text || '@temanbicara.test', 'psikolog', 'suspended');
    -- Target bukan pemilik JWT dan tidak aktif: klausa non-admin harus false.
    INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url)
    VALUES (target_id, 'Fixture T199', fixture_id::text, 'fixture.pdf');
    INSERT INTO public.relawan_profiles (user_id, nama_lengkap, latar_belakang, dokumen_cv_url, alasan_bergabung)
    VALUES (target_id, 'Fixture T199', 'Fixture', 'fixture.pdf', 'Fixture');
    INSERT INTO public.system_settings (key, value) VALUES (fixture_key, '{}'::jsonb);
    ASSERT EXISTS (SELECT 1 FROM public.system_settings_audit WHERE key = fixture_key), 'Fixture audit tidak dibuat';
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('dokumen-mitra', target_id::text || '/' || fixture_key || '.pdf');
    PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
END $test$;

SET LOCAL ROLE authenticated;
DO $suspended$
BEGIN
    ASSERT NOT public.is_admin(), 'Admin suspended lolos is_admin';
    ASSERT NOT EXISTS (SELECT user_id FROM public.psikolog_profiles WHERE user_id = current_setting('t199.target_id')::uuid), 'Suspended membaca psikolog';
    ASSERT NOT EXISTS (SELECT 1 FROM public.relawan_profiles WHERE user_id = current_setting('t199.target_id')::uuid), 'Suspended membaca relawan';
    ASSERT NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = current_setting('t199.fixture_key')), 'Suspended membaca settings';
    ASSERT NOT EXISTS (SELECT 1 FROM public.system_settings_audit WHERE key = current_setting('t199.fixture_key')), 'Suspended membaca audit';
    ASSERT NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'dokumen-mitra' AND name = current_setting('t199.target_id') || '/' || current_setting('t199.fixture_key') || '.pdf'), 'Suspended membaca dokumen';
END $suspended$;
RESET ROLE;

UPDATE public.users SET status = 'active' WHERE id = current_setting('t199.admin_id')::uuid;
SET LOCAL ROLE authenticated;
DO $active$
BEGIN
    ASSERT public.is_admin(), 'Admin active ditolak is_admin';
    ASSERT EXISTS (SELECT user_id FROM public.psikolog_profiles WHERE user_id = current_setting('t199.target_id')::uuid), 'Active ditolak psikolog';
    ASSERT EXISTS (SELECT 1 FROM public.relawan_profiles WHERE user_id = current_setting('t199.target_id')::uuid), 'Active ditolak relawan';
    ASSERT EXISTS (SELECT 1 FROM public.system_settings WHERE key = current_setting('t199.fixture_key')), 'Active ditolak settings';
    ASSERT EXISTS (SELECT 1 FROM public.system_settings_audit WHERE key = current_setting('t199.fixture_key')), 'Active ditolak audit';
    ASSERT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'dokumen-mitra' AND name = current_setting('t199.target_id') || '/' || current_setting('t199.fixture_key') || '.pdf'), 'Active ditolak dokumen';
    -- Exception sengaja: keberhasilan juga tidak pernah menyimpan fixture/DDL.
    RAISE EXCEPTION 'DRYRUN_OK';
END $active$;
ROLLBACK;
