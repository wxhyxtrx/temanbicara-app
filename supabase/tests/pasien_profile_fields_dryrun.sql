-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000008 (PASIEN PROFILE FIELDS)
-- Path: supabase/tests/pasien_profile_fields_dryrun.sql
-- Scope:
-- 1. Setup user test: auth.users -> public.users (role::public.user_role, status::public.account_status)
-- 2. DDL Salinan persis dari 20261017000008_pasien_profile_fields.sql
-- 3. Assert kolom pasien_profiles di information_schema
-- 4. Assert insert pasien_profiles dengan kolom baru
-- 5. Assert default value is_anonim_default
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users (to satisfy users_id_fkey)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    'd2000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dryrun_pasien@temanbicara.test',
    '',
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
), (
    'd2000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dryrun_pasien_default@temanbicara.test',
    '',
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES (
    'd2000000-0000-0000-0000-000000000001',
    'dryrun_pasien@temanbicara.test',
    '081234567890',
    'pasien'::public.user_role,
    'active'::public.account_status
), (
    'd2000000-0000-0000-0000-000000000002',
    'dryrun_pasien_default@temanbicara.test',
    '081234567891',
    'pasien'::public.user_role,
    'active'::public.account_status
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261017000008_pasien_profile_fields.sql
-- ========================================================

-- 1. ALTER TABLE pasien_profiles
ALTER TABLE public.pasien_profiles
    ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
    ADD COLUMN IF NOT EXISTS kontak_darurat_nama TEXT,
    ADD COLUMN IF NOT EXISTS kontak_darurat_wa TEXT,
    ADD COLUMN IF NOT EXISTS is_anonim_default BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pasien_profiles.nama_panggilan IS 'Nama panggilan atau nama samaran (alias) pasien untuk sesi konseling';
COMMENT ON COLUMN public.pasien_profiles.kontak_darurat_nama IS 'Nama kontak darurat pasien untuk protokol keselamatan/krisis klinis';
COMMENT ON COLUMN public.pasien_profiles.kontak_darurat_wa IS 'Nomor WhatsApp kontak darurat pasien';
COMMENT ON COLUMN public.pasien_profiles.is_anonim_default IS 'Preferensi default pasien untuk menyembunyikan identitas asli saat konseling';

-- ========================================================
-- ASSERTIONS & VERIFIKASI
-- ========================================================

-- A. Assert Keberadaan Kolom Baru di pasien_profiles
DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(col, ', ') INTO v_missing
    FROM (
        SELECT 'nama_panggilan' AS col WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pasien_profiles' AND column_name = 'nama_panggilan'
        )
        UNION ALL
        SELECT 'kontak_darurat_nama' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pasien_profiles' AND column_name = 'kontak_darurat_nama'
        )
        UNION ALL
        SELECT 'kontak_darurat_wa' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pasien_profiles' AND column_name = 'kontak_darurat_wa'
        )
        UNION ALL
        SELECT 'is_anonim_default' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pasien_profiles' AND column_name = 'is_anonim_default'
        )
    ) t;

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Kolom berikut tidak ditemukan pada pasien_profiles: %', v_missing;
    END IF;
END;
$$;

-- B. Assert Insert Profil Pasien Berhasil Menggunakan Kolom Baru
DO $$
DECLARE
    v_test_user_id UUID := 'd2000000-0000-0000-0000-000000000001'::uuid;
    v_inserted_alias TEXT;
    v_inserted_emergency_name TEXT;
    v_inserted_emergency_wa TEXT;
    v_inserted_anonim BOOLEAN;
BEGIN
    INSERT INTO public.pasien_profiles (
        user_id,
        nama_lengkap,
        nama_panggilan,
        kontak_darurat_nama,
        kontak_darurat_wa,
        is_anonim_default
    ) VALUES (
        v_test_user_id,
        'Pasien Uji Coba',
        'Budi',
        'Ibu Ratna (Keluarga)',
        '081198765432',
        false
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nama_lengkap = EXCLUDED.nama_lengkap,
        nama_panggilan = EXCLUDED.nama_panggilan,
        kontak_darurat_nama = EXCLUDED.kontak_darurat_nama,
        kontak_darurat_wa = EXCLUDED.kontak_darurat_wa,
        is_anonim_default = EXCLUDED.is_anonim_default;

    SELECT nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
    INTO v_inserted_alias, v_inserted_emergency_name, v_inserted_emergency_wa, v_inserted_anonim
    FROM public.pasien_profiles
    WHERE user_id = v_test_user_id;

    IF v_inserted_alias <> 'Budi' THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: nama_panggilan tidak cocok (dapat %)', v_inserted_alias;
    END IF;

    IF v_inserted_emergency_name <> 'Ibu Ratna (Keluarga)' THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: kontak_darurat_nama tidak cocok (dapat %)', v_inserted_emergency_name;
    END IF;

    IF v_inserted_emergency_wa <> '081198765432' THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: kontak_darurat_wa tidak cocok (dapat %)', v_inserted_emergency_wa;
    END IF;

    IF v_inserted_anonim <> false THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: is_anonim_default harus false';
    END IF;
END;
$$;

-- C. Assert Default Value is_anonim_default adalah false
DO $$
DECLARE
    v_default_user_id UUID := 'd2000000-0000-0000-0000-000000000002'::uuid;
    v_default_anonim BOOLEAN;
BEGIN
    INSERT INTO public.pasien_profiles (
        user_id,
        nama_lengkap
    ) VALUES (
        v_default_user_id,
        'Pasien Default Test'
    )
    ON CONFLICT (user_id) DO NOTHING;

    SELECT is_anonim_default
    INTO v_default_anonim
    FROM public.pasien_profiles
    WHERE user_id = v_default_user_id;

    IF v_default_anonim <> false THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: default is_anonim_default bukan false (dapat %)', v_default_anonim;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK
-- ========================================================
SELECT 'SEMUA TEST DRY-RUN 000008 LULUS' AS hasil;

ROLLBACK;
