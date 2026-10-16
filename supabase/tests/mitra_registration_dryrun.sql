-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000007 (RELAWAN PROFILES & DOKUMEN MITRA)
-- Path: supabase/tests/mitra_registration_dryrun.sql
-- Scope:
-- 1. Setup user test: auth.users -> public.users (role::public.user_role, status::public.account_status)
-- 2. DDL Salinan persis dari 20261016000007_relawan_profiles_and_dokumen_mitra.sql
-- 3. Assert kolom relawan_profiles di information_schema
-- 4. Assert insert relawan_profiles dengan kolom baru
-- 5. Assert storage.buckets 'dokumen-mitra' konfigurasi PDF & 5MB
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
    'd1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dryrun_relawan@temanbicara.test',
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
    'd1000000-0000-0000-0000-000000000001',
    'dryrun_relawan@temanbicara.test',
    '081122334455',
    'relawan'::public.user_role,
    'pending_approval'::public.account_status
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261016000007_relawan_profiles_and_dokumen_mitra.sql
-- ========================================================

-- 1. ALTER TABLE relawan_profiles
ALTER TABLE public.relawan_profiles
    ADD COLUMN IF NOT EXISTS alias_name TEXT,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS topik_keahlian TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS rating_rata_rata NUMERIC(3, 2);

COMMENT ON COLUMN public.relawan_profiles.alias_name IS 'Nama samaran publik relawan untuk menjaga anonimitas';
COMMENT ON COLUMN public.relawan_profiles.is_available IS 'Status ketersediaan relawan untuk menerima sesi konsultasi';
COMMENT ON COLUMN public.relawan_profiles.topik_keahlian IS 'Daftar topik curhat / keahlian yang dapat ditangani relawan';
COMMENT ON COLUMN public.relawan_profiles.rating_rata_rata IS 'Rata-rata rating relawan (maksimal 5.00)';

-- 2. UPDATE storage.buckets
UPDATE storage.buckets
SET allowed_mime_types = '{application/pdf}',
    file_size_limit = 5242880
WHERE id = 'dokumen-mitra';

-- ========================================================
-- ASSERTIONS & VERIFIKASI
-- ========================================================

-- A. Assert Keberadaan Kolom Baru di relawan_profiles
DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(col, ', ') INTO v_missing
    FROM (
        SELECT 'alias_name' AS col WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'relawan_profiles' AND column_name = 'alias_name'
        )
        UNION ALL
        SELECT 'is_available' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'relawan_profiles' AND column_name = 'is_available'
        )
        UNION ALL
        SELECT 'topik_keahlian' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'relawan_profiles' AND column_name = 'topik_keahlian'
        )
        UNION ALL
        SELECT 'rating_rata_rata' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'relawan_profiles' AND column_name = 'rating_rata_rata'
        )
    ) t;

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Kolom berikut tidak ditemukan pada relawan_profiles: %', v_missing;
    END IF;
END;
$$;

-- B. Assert Insert Profil Relawan Berhasil Menggunakan Kolom Baru
DO $$
DECLARE
    v_test_user_id UUID := 'd1000000-0000-0000-0000-000000000001'::uuid;
    v_inserted_alias TEXT;
    v_inserted_available BOOLEAN;
    v_inserted_topik TEXT[];
    v_inserted_rating NUMERIC(3,2);
BEGIN
    INSERT INTO public.relawan_profiles (
        user_id,
        nama_lengkap,
        latar_belakang,
        dokumen_cv_url,
        alasan_bergabung,
        total_sesi,
        alias_name,
        is_available,
        topik_keahlian,
        rating_rata_rata
    ) VALUES (
        v_test_user_id,
        'Relawan Uji Coba',
        'S1 Psikologi',
        'dryrun_relawan/cv-12345.pdf',
        'Ingin membantu sesama pendengar dengan empati penuh.',
        0,
        'Relawan',
        false,
        ARRAY['Dukungan Teman Curhat', 'Keluarga']::text[],
        4.85
    )
    ON CONFLICT (user_id) DO UPDATE SET
        alias_name = EXCLUDED.alias_name,
        is_available = EXCLUDED.is_available,
        topik_keahlian = EXCLUDED.topik_keahlian,
        rating_rata_rata = EXCLUDED.rating_rata_rata;

    SELECT alias_name, is_available, topik_keahlian, rating_rata_rata
    INTO v_inserted_alias, v_inserted_available, v_inserted_topik, v_inserted_rating
    FROM public.relawan_profiles
    WHERE user_id = v_test_user_id;

    IF v_inserted_alias <> 'Relawan' THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: alias_name tidak cocok (dapat %)', v_inserted_alias;
    END IF;

    IF v_inserted_available <> false THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: is_available harus false default';
    END IF;

    IF NOT ('Dukungan Teman Curhat' = ANY(v_inserted_topik)) THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: topik_keahlian tidak tersimpan dengan benar';
    END IF;

    IF v_inserted_rating <> 4.85 THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: rating_rata_rata tidak cocok (dapat %)', v_inserted_rating;
    END IF;
END;
$$;

-- C. Assert Storage Bucket 'dokumen-mitra' Berisi Konfigurasi PDF Saja & Maks 5MB
DO $$
DECLARE
    v_mime TEXT[];
    v_size_limit BIGINT;
BEGIN
    SELECT allowed_mime_types, file_size_limit
    INTO v_mime, v_size_limit
    FROM storage.buckets
    WHERE id = 'dokumen-mitra';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: bucket dokumen-mitra tidak ditemukan di storage.buckets';
    END IF;

    IF v_mime <> '{application/pdf}'::text[] AND v_mime <> ARRAY['application/pdf']::text[] THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: allowed_mime_types harus {application/pdf}, didapat: %', v_mime;
    END IF;

    IF v_size_limit <> 5242880 THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: file_size_limit harus 5242880 bytes (5MB), didapat: %', v_size_limit;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK
-- ========================================================
SELECT 'SEMUA TEST DRY-RUN 000007 LULUS' AS hasil;

ROLLBACK;
