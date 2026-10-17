-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000009 (BOOKING SETTINGS)
-- Path: supabase/tests/booking_settings_dryrun.sql
-- Scope:
-- 1. Setup table public.system_settings IF NOT EXISTS
-- 2. DDL/DML Salinan persis dari 20261017000009_booking_settings.sql
-- 3. Assert keberadaan key 'booking', 'strike', 'rating'
-- 4. Assert value->>'max_active_per_patient' = '3'
-- 5. Assert (value->>'threshold')::int = 3
-- 6. Assert (value->>'min_count_to_show')::int = 3
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP TABEL (JIKA BELUM ADA)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ========================================================
-- SALINAN PERSIS DDL/DML DARI 20261017000009_booking_settings.sql
-- ========================================================

INSERT INTO public.system_settings (key, value)
VALUES
    (
        'booking',
        '{"min_hours_before": 2, "max_days_ahead": 14, "max_active_per_patient": 3, "max_per_psikolog_per_day": 1, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb
    ),
    (
        'strike',
        '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb
    ),
    (
        'rating',
        '{"window_days": 7, "min_count_to_show": 3}'::jsonb
    )
ON CONFLICT (key) DO NOTHING;

-- ========================================================
-- ASSERTIONS & VERIFIKASI
-- ========================================================

DO $$
DECLARE
    v_max_active TEXT;
    v_strike_threshold INT;
    v_rating_min_count INT;
    v_missing_keys TEXT;
BEGIN
    -- A. Assert semua key baru terdaftar
    SELECT string_agg(k, ', ') INTO v_missing_keys
    FROM (
        SELECT 'booking' AS k WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'booking')
        UNION ALL
        SELECT 'strike' WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'strike')
        UNION ALL
        SELECT 'rating' WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'rating')
    ) t;

    IF v_missing_keys IS NOT NULL THEN
        RAISE EXCEPTION 'TEST 1 GAGAL: Key berikut tidak ditemukan pada system_settings: %', v_missing_keys;
    END IF;

    -- B. Assert booking.max_active_per_patient = '3'
    SELECT value->>'max_active_per_patient' INTO v_max_active
    FROM public.system_settings
    WHERE key = 'booking';

    IF v_max_active <> '3' THEN
        RAISE EXCEPTION 'TEST 2 GAGAL: booking.max_active_per_patient harus 3 (dapat %)', v_max_active;
    END IF;

    -- C. Assert strike.threshold = 3
    SELECT (value->>'threshold')::int INTO v_strike_threshold
    FROM public.system_settings
    WHERE key = 'strike';

    IF v_strike_threshold <> 3 THEN
        RAISE EXCEPTION 'TEST 3 GAGAL: strike.threshold harus 3 (dapat %)', v_strike_threshold;
    END IF;

    -- D. Assert rating.min_count_to_show = 3
    SELECT (value->>'min_count_to_show')::int INTO v_rating_min_count
    FROM public.system_settings
    WHERE key = 'rating';

    IF v_rating_min_count <> 3 THEN
        RAISE EXCEPTION 'TEST 4 GAGAL: rating.min_count_to_show harus 3 (dapat %)', v_rating_min_count;
    END IF;
END;
$$;

-- ========================================================
-- HASIL FINAL & AUTOMATIC ROLLBACK
-- ========================================================
SELECT 'SEMUA TEST DRY-RUN 000009 LULUS' AS hasil;

ROLLBACK;
