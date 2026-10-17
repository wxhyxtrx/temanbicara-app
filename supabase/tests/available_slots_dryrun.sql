-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000011 (AVAILABLE SLOTS)
-- Path: supabase/tests/available_slots_dryrun.sql
-- Scope:
-- 1. Setup user test psikolog (auth.users -> public.users -> psikolog_profiles)
-- 2. DDL Salinan persis dari 20261017000011_available_slots.sql
-- 3. Assert pola Senin 19.00-21.00 WIB -> tepat 2 slot (19.00 & 20.00)
-- 4. Assert time_off Senin 19.00-20.00 WIB -> sisa 1 slot (20.00)
-- 5. Review Focus #2: Assert pola Minggu (weekday 0) 23.00-24.00 WIB -> slot jatuh Minggu 23.00 WIB (to_char '1 23')
-- 6. Assert booking_paused = true -> 0 slot
-- 7. Assert filter min_hours_before: slot < now() + min_hours_before tidak muncul
-- 8. Assert suspended_until > now() -> 0 slot
-- 9. Assert user non-active -> 0 slot
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
    'e3000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dryrun_available_slots@temanbicara.test',
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
    'e3000000-0000-0000-0000-000000000001',
    'dryrun_available_slots@temanbicara.test',
    '081299990003',
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
    tarif_sesi,
    booking_paused
) VALUES (
    'e3000000-0000-0000-0000-000000000001',
    'Dr. Slot Tester, M.Psi',
    'SIPP-88888888-TEST',
    'https://storage.test/sipp-slots.pdf',
    ARRAY['Kecemasan'],
    3,
    150000,
    false
)
ON CONFLICT (user_id) DO UPDATE SET
    booking_paused = false,
    suspended_until = NULL;

-- 4. SETUP SYSTEM SETTINGS: booking
INSERT INTO public.system_settings (key, value)
VALUES (
    'booking',
    '{"min_hours_before": 2, "max_days_ahead": 14, "max_active_per_patient": 3, "max_per_psikolog_per_day": 1, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261017000011_available_slots.sql
-- ========================================================

CREATE OR REPLACE FUNCTION public.psikolog_available_slots(
    p_psikolog_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ
)
RETURNS SETOF TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_active BOOLEAN;
    v_booking_paused BOOLEAN;
    v_suspended_until TIMESTAMPTZ;
    v_min_hours_before INTEGER := 2;
    v_max_days_ahead INTEGER := 14;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- 1. Validasi parameter input
    IF p_psikolog_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
        RETURN;
    END IF;

    -- 2. Cek status user & profil psikolog
    SELECT
        (u.status = 'active'),
        p.booking_paused,
        p.suspended_until
    INTO
        v_is_active,
        v_booking_paused,
        v_suspended_until
    FROM public.users u
    JOIN public.psikolog_profiles p ON p.user_id = u.id
    WHERE u.id = p_psikolog_id
      AND u.role = 'psikolog';

    IF NOT FOUND OR NOT COALESCE(v_is_active, false) OR COALESCE(v_booking_paused, false) THEN
        RETURN;
    END IF;

    IF v_suspended_until IS NOT NULL AND v_suspended_until > pg_catalog.now() THEN
        RETURN;
    END IF;

    -- 3. Ambil setting booking dari system_settings
    SELECT
        COALESCE((value->>'min_hours_before')::INTEGER, 2),
        COALESCE((value->>'max_days_ahead')::INTEGER, 14)
    INTO
        v_min_hours_before,
        v_max_days_ahead
    FROM public.system_settings
    WHERE key = 'booking';

    v_min_hours_before := COALESCE(v_min_hours_before, 2);
    v_max_days_ahead := COALESCE(v_max_days_ahead, 14);

    -- 4. Tentukan rentang tanggal kalender WIB
    v_start_date := (p_from AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_end_date := (p_to AT TIME ZONE 'Asia/Jakarta')::DATE;

    -- 5. Generate seluruh kandidat slot per hari & jam pola mingguan
    RETURN QUERY
    WITH days AS (
        SELECT
            d_series.day_ts::DATE AS d,
            EXTRACT(DOW FROM d_series.day_ts)::SMALLINT AS dow
        FROM pg_catalog.generate_series(
            v_start_date::timestamp,
            v_end_date::timestamp,
            INTERVAL '1 day'
        ) AS d_series(day_ts)
    ),
    raw_slots AS (
        SELECT
            ((days.d + (g.hour_num * INTERVAL '1 hour')) AT TIME ZONE 'Asia/Jakarta') AS slot
        FROM days
        JOIN public.psikolog_schedules sch
            ON sch.psikolog_id = p_psikolog_id
           AND sch.weekday = days.dow
        CROSS JOIN LATERAL pg_catalog.generate_series(
            sch.start_hour::INTEGER,
            (sch.end_hour - 1)::INTEGER
        ) AS g(hour_num)
    )
    SELECT DISTINCT rs.slot
    FROM raw_slots rs
    WHERE rs.slot >= p_from
      AND rs.slot < p_to
      AND rs.slot >= (pg_catalog.now() + (v_min_hours_before * INTERVAL '1 hour'))
      AND rs.slot <= (pg_catalog.now() + (v_max_days_ahead * INTERVAL '1 day'))
      AND NOT EXISTS (
          SELECT 1
          FROM public.psikolog_time_off tof
          WHERE tof.psikolog_id = p_psikolog_id
            AND rs.slot < tof.end_at
            AND (rs.slot + INTERVAL '1 hour') > tof.start_at
      )
    ORDER BY rs.slot ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ========================================================
-- EKSEKUSI ASSERTIONS
-- ========================================================

DO $$
DECLARE
    v_psikolog_id UUID := 'e3000000-0000-0000-0000-000000000001';
    v_now_wib TIMESTAMP;
    v_days_to_monday INTEGER;
    v_monday_date DATE;
    v_mon_from TIMESTAMPTZ;
    v_mon_to TIMESTAMPTZ;
    v_slot_count INTEGER;
    v_slot_hours INTEGER[];
    v_days_to_sunday INTEGER;
    v_sunday_date DATE;
    v_sun_from TIMESTAMPTZ;
    v_sun_to TIMESTAMPTZ;
    v_sun_slot TIMESTAMPTZ;
    v_sun_char TEXT;
    v_sun_dow SMALLINT;
    v_tomorrow_date DATE;
    v_tomorrow_dow SMALLINT;
    v_tomorrow_from TIMESTAMPTZ;
    v_tomorrow_to TIMESTAMPTZ;
BEGIN
    v_now_wib := (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta');

    -- ========================================================
    -- TEST 1: Pola Senin 19.00-21.00 WIB -> Tepat 2 slot (19.00 & 20.00)
    -- ========================================================
    DELETE FROM public.psikolog_schedules WHERE psikolog_id = v_psikolog_id;
    DELETE FROM public.psikolog_time_off WHERE psikolog_id = v_psikolog_id;

    INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
    VALUES (v_psikolog_id, 1, 19, 21);

    -- Cari hari Senin aman (antara 2 sampai 8 hari ke depan)
    v_days_to_monday := (8 - EXTRACT(DOW FROM v_now_wib)::INTEGER) % 7;
    IF v_days_to_monday < 2 THEN
        v_days_to_monday := v_days_to_monday + 7;
    END IF;
    v_monday_date := (v_now_wib::DATE + (v_days_to_monday * INTERVAL '1 day'))::DATE;

    v_mon_from := (v_monday_date::timestamp) AT TIME ZONE 'Asia/Jakarta';
    v_mon_to := ((v_monday_date::timestamp) + INTERVAL '7 days') AT TIME ZONE 'Asia/Jakarta';

    SELECT count(*), array_agg(EXTRACT(HOUR FROM slot AT TIME ZONE 'Asia/Jakarta')::INTEGER ORDER BY slot)
    INTO v_slot_count, v_slot_hours
    FROM public.psikolog_available_slots(v_psikolog_id, v_mon_from, v_mon_to);

    IF v_slot_count <> 2 THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Diharapkan tepat 2 slot untuk pola Senin 19-21, didapat %', v_slot_count;
    END IF;

    IF v_slot_hours <> ARRAY[19, 20] THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Jam slot diharapkan [19, 20], didapat %', v_slot_hours;
    END IF;

    -- ========================================================
    -- TEST 2: Tambah time_off Senin 19.00-20.00 -> Sisa 1 slot (20.00)
    -- ========================================================
    INSERT INTO public.psikolog_time_off (psikolog_id, start_at, end_at, reason)
    VALUES (
        v_psikolog_id,
        (v_monday_date::timestamp + INTERVAL '19 hours') AT TIME ZONE 'Asia/Jakarta',
        (v_monday_date::timestamp + INTERVAL '20 hours') AT TIME ZONE 'Asia/Jakarta',
        'Ada rapat'
    );

    SELECT count(*), array_agg(EXTRACT(HOUR FROM slot AT TIME ZONE 'Asia/Jakarta')::INTEGER ORDER BY slot)
    INTO v_slot_count, v_slot_hours
    FROM public.psikolog_available_slots(v_psikolog_id, v_mon_from, v_mon_to);

    IF v_slot_count <> 1 THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: Diharapkan 1 slot setelah time_off 19-20, didapat %', v_slot_count;
    END IF;

    IF v_slot_hours <> ARRAY[20] THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: Jam slot tersisa diharapkan [20], didapat %', v_slot_hours;
    END IF;

    -- ========================================================
    -- TEST 3: Review Focus #2 - Pola Minggu (weekday 0) 23.00-24.00 WIB
    -- Slot harus jatuh Minggu 23.00 WIB (to_char '1 23'), bukan Senin (bug UTC)
    -- ========================================================
    DELETE FROM public.psikolog_schedules WHERE psikolog_id = v_psikolog_id;
    DELETE FROM public.psikolog_time_off WHERE psikolog_id = v_psikolog_id;

    INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
    VALUES (v_psikolog_id, 0, 23, 24);

    -- Cari hari Minggu aman (antara 2 sampai 8 hari ke depan)
    v_days_to_sunday := (7 - EXTRACT(DOW FROM v_now_wib)::INTEGER) % 7;
    IF v_days_to_sunday < 2 THEN
        v_days_to_sunday := v_days_to_sunday + 7;
    END IF;
    v_sunday_date := (v_now_wib::DATE + (v_days_to_sunday * INTERVAL '1 day'))::DATE;

    v_sun_from := (v_sunday_date::timestamp) AT TIME ZONE 'Asia/Jakarta';
    v_sun_to := ((v_sunday_date::timestamp) + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta';

    SELECT count(*), min(slot)
    INTO v_slot_count, v_sun_slot
    FROM public.psikolog_available_slots(v_psikolog_id, v_sun_from, v_sun_to);

    IF v_slot_count <> 1 THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: Diharapkan 1 slot untuk pola Minggu 23-24, didapat %', v_slot_count;
    END IF;

    v_sun_char := pg_catalog.to_char(v_sun_slot AT TIME ZONE 'Asia/Jakarta', 'D HH24');
    v_sun_dow := EXTRACT(DOW FROM v_sun_slot AT TIME ZONE 'Asia/Jakarta')::SMALLINT;

    IF v_sun_char <> '1 23' THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: to_char diharapkan "1 23" (Minggu 23:00 WIB), didapat "%"', v_sun_char;
    END IF;

    IF v_sun_dow <> 0 THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: EXTRACT DOW diharapkan 0 (Minggu), didapat %', v_sun_dow;
    END IF;

    -- ========================================================
    -- TEST 4: Toggle booking_paused = true -> 0 slot
    -- ========================================================
    UPDATE public.psikolog_profiles
    SET booking_paused = true
    WHERE user_id = v_psikolog_id;

    SELECT count(*)
    INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_sun_from, v_sun_to);

    IF v_slot_count <> 0 THEN
        RAISE EXCEPTION 'TEST 4 GAGAL: booking_paused=true harus menghasilkan 0 slot, didapat %', v_slot_count;
    END IF;

    UPDATE public.psikolog_profiles
    SET booking_paused = false
    WHERE user_id = v_psikolog_id;

    -- ========================================================
    -- TEST 5: Filter min_hours_before -> slot < now() + min_hours_before tidak muncul
    -- ========================================================
    -- Pasang min_hours_before = 48 jam di system_settings
    UPDATE public.system_settings
    SET value = pg_catalog.jsonb_set(value, '{min_hours_before}', '48'::jsonb)
    WHERE key = 'booking';

    DELETE FROM public.psikolog_schedules WHERE psikolog_id = v_psikolog_id;

    v_tomorrow_date := (v_now_wib::DATE + INTERVAL '1 day')::DATE;
    v_tomorrow_dow := EXTRACT(DOW FROM v_tomorrow_date)::SMALLINT;
    v_tomorrow_from := (v_tomorrow_date::timestamp) AT TIME ZONE 'Asia/Jakarta';
    v_tomorrow_to := ((v_tomorrow_date::timestamp) + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta';

    INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
    VALUES (v_psikolog_id, v_tomorrow_dow, 10, 11);

    -- Karena min_hours_before = 48 jam, slot besok (24 jam) harus tidak muncul
    SELECT count(*)
    INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_tomorrow_from, v_tomorrow_to);

    IF v_slot_count <> 0 THEN
        RAISE EXCEPTION 'TEST 5 GAGAL: min_hours_before=48 jam harus menyaring slot besok, didapat %', v_slot_count;
    END IF;

    -- Kembalikan min_hours_before = 2 jam
    UPDATE public.system_settings
    SET value = pg_catalog.jsonb_set(value, '{min_hours_before}', '2'::jsonb)
    WHERE key = 'booking';

    -- Sekarang slot besok (>2 jam) harus muncul tepat 1
    SELECT count(*)
    INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_tomorrow_from, v_tomorrow_to);

    IF v_slot_count <> 1 THEN
        RAISE EXCEPTION 'TEST 5 GAGAL: min_hours_before=2 jam harus meloloskan slot besok, didapat %', v_slot_count;
    END IF;

    -- ========================================================
    -- TEST 6: suspended_until > now() -> 0 slot
    -- ========================================================
    UPDATE public.psikolog_profiles
    SET suspended_until = pg_catalog.now() + INTERVAL '7 days'
    WHERE user_id = v_psikolog_id;

    SELECT count(*)
    INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_sun_from, v_sun_to);

    IF v_slot_count <> 0 THEN
        RAISE EXCEPTION 'TEST 6 GAGAL: suspended_until > now() harus menghasilkan 0 slot, didapat %', v_slot_count;
    END IF;

    UPDATE public.psikolog_profiles
    SET suspended_until = NULL
    WHERE user_id = v_psikolog_id;

    -- ========================================================
    -- TEST 7: User status bukan active -> 0 slot
    -- ========================================================
    UPDATE public.users
    SET status = 'suspended'::public.account_status
    WHERE id = v_psikolog_id;

    SELECT count(*)
    INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_sun_from, v_sun_to);

    IF v_slot_count <> 0 THEN
        RAISE EXCEPTION 'TEST 7 GAGAL: User status tidak aktif harus menghasilkan 0 slot, didapat %', v_slot_count;
    END IF;

    UPDATE public.users
    SET status = 'active'::public.account_status
    WHERE id = v_psikolog_id;

    RAISE NOTICE 'SELURUH UJI GENERATOR SLOT (TASK B3) BERHASIL!';
END;
$$;

ROLLBACK;
