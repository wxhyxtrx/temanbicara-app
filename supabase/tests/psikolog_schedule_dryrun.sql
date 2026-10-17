-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000010 (PSIKOLOG SCHEDULE)
-- Path: supabase/tests/psikolog_schedule_dryrun.sql
-- Scope:
-- 1. Setup user test psikolog (auth.users -> public.users -> psikolog_profiles)
-- 2. DDL Salinan persis dari 20261017000010_psikolog_schedule.sql
-- 3. Assert kolom baru di psikolog_profiles & default booking_paused
-- 4. Assert insert pola jadwal valid
-- 5. Assert insert start_hour=21, end_hour=19 gagal (CHECK)
-- 6. Assert insert weekday di luar 0-6 gagal (CHECK)
-- 7. Assert insert time_off valid dan end_at <= start_at gagal (CHECK)
-- 8. Assert RLS aktif di kedua tabel
-- 9. Assert RPC psikolog_schedule_replace 2 rentang -> 2 baris
-- 10. Assert RPC psikolog_schedule_replace invalid -> exception & baris lama tetap utuh (atomik)
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
    'e1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dryrun_psikolog_schedule@temanbicara.test',
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
    'e1000000-0000-0000-0000-000000000001',
    'dryrun_psikolog_schedule@temanbicara.test',
    '081299990001',
    'psikolog'::public.user_role,
    'active'::public.account_status
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 3. SETUP PROFIL: public.psikolog_profiles
INSERT INTO public.psikolog_profiles (
    user_id,
    nama_lengkap_gelar,
    nomor_sipp_str,
    dokumen_sipp_str_url,
    spesialisasi,
    tahun_pengalaman,
    tarif_sesi
) VALUES (
    'e1000000-0000-0000-0000-000000000001',
    'Dr. Test Psikolog, M.Psi',
    'SIPP-12345678-TEST',
    'https://storage.test/sipp.pdf',
    ARRAY['Kecemasan', 'Depresi'],
    5,
    150000
)
ON CONFLICT (user_id) DO NOTHING;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261017000010_psikolog_schedule.sql
-- ========================================================

-- 1. TABEL PSIKOLOG_SCHEDULES (Pola Mingguan)
CREATE TABLE IF NOT EXISTS public.psikolog_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0 = Minggu (WIB), 6 = Sabtu
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour SMALLINT NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_psikolog_schedules_hours CHECK (end_hour > start_hour)
);

CREATE INDEX IF NOT EXISTS idx_psikolog_schedules_psikolog_weekday
    ON public.psikolog_schedules(psikolog_id, weekday);

-- 2. TABEL PSIKOLOG_TIME_OFF (Libur / Pengecualian)
CREATE TABLE IF NOT EXISTS public.psikolog_time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_psikolog_time_off_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_psikolog_time_off_psikolog_range
    ON public.psikolog_time_off(psikolog_id, start_at, end_at);

-- 3. KOLOM TAMBAHAN PADA PSIKOLOG_PROFILES
ALTER TABLE public.psikolog_profiles
    ADD COLUMN IF NOT EXISTS booking_paused BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS extension_price_coins INTEGER NULL,
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.psikolog_profiles.booking_paused IS 'Toggle jeda terima booking dari pasien';
COMMENT ON COLUMN public.psikolog_profiles.extension_price_coins IS 'Harga koin untuk ekstensi sesi 10 menit yang ditentukan psikolog';
COMMENT ON COLUMN public.psikolog_profiles.suspended_until IS 'Batas waktu penalti suspensi akibat akumulasi strike';

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.psikolog_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psikolog_time_off ENABLE ROW LEVEL SECURITY;

-- 5. RPC FUNCTION: ATOMIC REPLACE JADWAL MINGGUAN PSIKOLOG
CREATE OR REPLACE FUNCTION public.psikolog_schedule_replace(
    p_psikolog_id UUID,
    p_weekly JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- 1. Hapus jadwal pola mingguan milik psikolog ini
    DELETE FROM public.psikolog_schedules
    WHERE psikolog_id = p_psikolog_id;

    -- 2. Insert baris baru jika p_weekly berupa jsonb array yang tidak kosong
    IF p_weekly IS NOT NULL AND pg_catalog.jsonb_typeof(p_weekly) = 'array' AND pg_catalog.jsonb_array_length(p_weekly) > 0 THEN
        INSERT INTO public.psikolog_schedules (
            psikolog_id,
            weekday,
            start_hour,
            end_hour
        )
        SELECT
            p_psikolog_id,
            (elem->>'weekday')::SMALLINT,
            (elem->>'start_hour')::SMALLINT,
            (elem->>'end_hour')::SMALLINT
        FROM pg_catalog.jsonb_array_elements(p_weekly) AS elem;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.psikolog_schedule_replace(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psikolog_schedule_replace(UUID, JSONB) TO service_role;

-- ========================================================
-- ASSERTIONS & VERIFIKASI
-- ========================================================

DO $$
DECLARE
    v_test_user_id UUID := 'e1000000-0000-0000-0000-000000000001'::uuid;
    v_missing TEXT;
    v_booking_paused BOOLEAN;
    v_schedule_count INT;
    v_time_off_count INT;
    v_caught_check BOOLEAN;
    v_rls_schedules BOOLEAN;
    v_rls_time_off BOOLEAN;
BEGIN
    -- A. Assert Keberadaan Kolom Baru di psikolog_profiles
    SELECT string_agg(col, ', ') INTO v_missing
    FROM (
        SELECT 'booking_paused' AS col WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'psikolog_profiles' AND column_name = 'booking_paused'
        )
        UNION ALL
        SELECT 'extension_price_coins' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'psikolog_profiles' AND column_name = 'extension_price_coins'
        )
        UNION ALL
        SELECT 'suspended_until' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'psikolog_profiles' AND column_name = 'suspended_until'
        )
    ) t;

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Kolom berikut tidak ditemukan pada psikolog_profiles: %', v_missing;
    END IF;

    -- B. Assert Default Value booking_paused adalah false
    SELECT booking_paused INTO v_booking_paused
    FROM public.psikolog_profiles
    WHERE user_id = v_test_user_id;

    IF v_booking_paused <> false THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: default booking_paused harus false (dapat %)', v_booking_paused;
    END IF;

    -- C. Assert Insert Jadwal Pola Mingguan Valid Berhasil
    INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
    VALUES (v_test_user_id, 1, 9, 12); -- Senin 09.00 - 12.00 WIB

    SELECT count(*) INTO v_schedule_count
    FROM public.psikolog_schedules
    WHERE psikolog_id = v_test_user_id;

    IF v_schedule_count <> 1 THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: Insert pola jadwal valid gagal';
    END IF;

    -- D. Assert Insert start_hour=21, end_hour=19 Gagal (CHECK end_hour > start_hour)
    v_caught_check := false;
    BEGIN
        INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
        VALUES (v_test_user_id, 1, 21, 19);
    EXCEPTION WHEN check_violation THEN
        v_caught_check := true;
    END;

    IF NOT v_caught_check THEN
        RAISE EXCEPTION 'TEST 4 GAGAL: Insert start_hour=21, end_hour=19 harus gagal CHECK constraint';
    END IF;

    -- E. Assert Insert start_hour=20, end_hour=20 Gagal (CHECK end_hour > start_hour)
    v_caught_check := false;
    BEGIN
        INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
        VALUES (v_test_user_id, 1, 20, 20);
    EXCEPTION WHEN check_violation THEN
        v_caught_check := true;
    END;

    IF NOT v_caught_check THEN
        RAISE EXCEPTION 'TEST 5 GAGAL: Insert start_hour=20, end_hour=20 harus gagal CHECK constraint';
    END IF;

    -- F. Assert Insert weekday=7 Gagal (CHECK weekday 0-6)
    v_caught_check := false;
    BEGIN
        INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
        VALUES (v_test_user_id, 7, 10, 11);
    EXCEPTION WHEN check_violation THEN
        v_caught_check := true;
    END;

    IF NOT v_caught_check THEN
        RAISE EXCEPTION 'TEST 6 GAGAL: Insert weekday=7 harus gagal CHECK constraint';
    END IF;

    -- G. Assert Insert psikolog_time_off Valid Berhasil
    INSERT INTO public.psikolog_time_off (psikolog_id, start_at, end_at, reason)
    VALUES (
        v_test_user_id,
        '2026-10-20T08:00:00+07:00'::timestamptz,
        '2026-10-20T17:00:00+07:00'::timestamptz,
        'Cuti pelatihan klinis'
    );

    SELECT count(*) INTO v_time_off_count
    FROM public.psikolog_time_off
    WHERE psikolog_id = v_test_user_id;

    IF v_time_off_count <> 1 THEN
        RAISE EXCEPTION 'TEST 7 GAGAL: Insert time_off valid gagal';
    END IF;

    -- H. Assert Insert psikolog_time_off end_at <= start_at Gagal (CHECK)
    v_caught_check := false;
    BEGIN
        INSERT INTO public.psikolog_time_off (psikolog_id, start_at, end_at, reason)
        VALUES (
            v_test_user_id,
            '2026-10-20T17:00:00+07:00'::timestamptz,
            '2026-10-20T08:00:00+07:00'::timestamptz,
            'Invalid time range'
        );
    EXCEPTION WHEN check_violation THEN
        v_caught_check := true;
    END;

    IF NOT v_caught_check THEN
        RAISE EXCEPTION 'TEST 8 GAGAL: Insert time_off end_at <= start_at harus gagal CHECK constraint';
    END IF;

    -- I. Assert RLS Aktif pada Kedua Tabel
    SELECT relrowsecurity INTO v_rls_schedules
    FROM pg_class
    WHERE relname = 'psikolog_schedules';

    SELECT relrowsecurity INTO v_rls_time_off
    FROM pg_class
    WHERE relname = 'psikolog_time_off';

    IF NOT (v_rls_schedules AND v_rls_time_off) THEN
        RAISE EXCEPTION 'TEST 9 GAGAL: RLS belum aktif pada salah satu atau kedua tabel schedule/time_off';
    END IF;

    -- J. Assert RPC psikolog_schedule_replace dengan 2 rentang -> menghasilkan 2 baris
    PERFORM public.psikolog_schedule_replace(
        v_test_user_id,
        '[{"weekday": 1, "start_hour": 9, "end_hour": 12}, {"weekday": 2, "start_hour": 13, "end_hour": 17}]'::jsonb
    );

    SELECT count(*) INTO v_schedule_count
    FROM public.psikolog_schedules
    WHERE psikolog_id = v_test_user_id;

    IF v_schedule_count <> 2 THEN
        RAISE EXCEPTION 'TEST 10 GAGAL: psikolog_schedule_replace dengan 2 rentang harus menghasilkan 2 baris (dapat %)', v_schedule_count;
    END IF;

    -- K. Assert RPC psikolog_schedule_replace data invalid (start_hour=21, end_hour=19)
    --    harus raise exception DAN baris lama tetap ada (atomik / rollback)
    v_caught_check := false;
    BEGIN
        PERFORM public.psikolog_schedule_replace(
            v_test_user_id,
            '[{"weekday": 3, "start_hour": 21, "end_hour": 19}]'::jsonb
        );
    EXCEPTION WHEN check_violation THEN
        v_caught_check := true;
    END;

    IF NOT v_caught_check THEN
        RAISE EXCEPTION 'TEST 11 GAGAL: psikolog_schedule_replace dengan data invalid harus raise exception';
    END IF;

    SELECT count(*) INTO v_schedule_count
    FROM public.psikolog_schedules
    WHERE psikolog_id = v_test_user_id;

    IF v_schedule_count <> 2 THEN
        RAISE EXCEPTION 'TEST 12 GAGAL: Atomisitas gagal, baris lama terhapus setelah replace gagal (dapat % baris, ekspektasi tetap 2)', v_schedule_count;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK
-- ========================================================
SELECT 'SEMUA TEST DRY-RUN 000010 LULUS' AS hasil;

ROLLBACK;
