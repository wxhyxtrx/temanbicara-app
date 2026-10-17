-- ========================================================
-- TEMAN BICARA: GENERATOR SLOT PSIKOLOG (FASE 3 - TASK B3)
-- Migration: 20261017000011_available_slots.sql
-- ========================================================

-- 1. FUNGSI GENERATOR SLOT TERSEDIA
-- Slot dihitung dari pola mingguan psikolog (WIB) dikurangi waktu libur (time_off).
-- Filter booking ('booked', 'in_progress') akan ditambahkan di Task B4.
-- Filter dinamis: slot >= now() + min_hours_before dan slot <= now() + max_days_ahead dari system_settings.
-- Mengembalikan set kosong jika akun tidak aktif, booking_paused = true, atau suspended_until > now().

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

-- 2. HAK AKSES FUNGSI
REVOKE ALL ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
