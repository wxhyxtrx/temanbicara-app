-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000012 (BOOKINGS & SIKLUS BOOKING)
-- Path: supabase/tests/bookings_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 3 pasien di auth.users & public.users & profiles
-- 2. DDL Salinan persis dari 20261017000012_bookings.sql
-- 3. Assert booking ganda di slot sama -> SLOT_UNAVAILABLE & saldo pasien kedua tidak berubah (Review Focus #1)
-- 4. Assert saldo kurang -> INSUFFICIENT_COINS tanpa debit (Review Focus #4)
-- 5. Assert LIMIT_ACTIVE ke-4
-- 6. Assert LIMIT_DAILY
-- 7. Assert refund 100% / 65% (ceil) / 0% sesuai jarak waktu + bagi hasil sisa koin hangus (mitra_earnings + platform)
-- 8. Assert reschedule >24 jam sukses sekali, kedua gagal, <24 jam gagal
-- 9. Assert slot yang sudah dibooking hilang dari psikolog_available_slots
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b4000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b4_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b4000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b4_pasien1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b4000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b4_pasien2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b4000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b4_pasien3@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b4000000-0000-0000-0000-000000000001', 'b4_psikolog@temanbicara.test', '081299990011', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b4000000-0000-0000-0000-000000000002', 'b4_pasien1@temanbicara.test', '081299990012', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b4000000-0000-0000-0000-000000000003', 'b4_pasien2@temanbicara.test', '081299990013', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b4000000-0000-0000-0000-000000000004', 'b4_pasien3@temanbicara.test', '081299990014', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL PSIKOLOG
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins
) VALUES (
    'b4000000-0000-0000-0000-000000000001', 'Dr. B4 Psikolog, M.Psi', 'SIPP-B4-001', 'https://storage.test/sipp-b4.pdf',
    ARRAY['Kecemasan', 'Depresi'], 5, 150000, false, 2
)
ON CONFLICT (user_id) DO UPDATE SET
    tarif_sesi = EXCLUDED.tarif_sesi,
    booking_paused = false,
    suspended_until = NULL,
    extension_price_coins = 2;

-- Setup Jadwal Penuh Psikolog (Semua Hari, 00:00 - 24:00 WIB)
DELETE FROM public.psikolog_schedules WHERE psikolog_id = 'b4000000-0000-0000-0000-000000000001';
INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
SELECT 'b4000000-0000-0000-0000-000000000001', d, 0, 24
FROM pg_catalog.generate_series(0, 6) AS d;

-- 4. SETUP PROFIL PASIEN
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b4000000-0000-0000-0000-000000000002', 'Pasien Satu B4', 'Budi', 'Ibu Budi', '081100000001', false),
    ('b4000000-0000-0000-0000-000000000003', 'Pasien Dua B4', 'Dewi', 'Pak Dewi', '081100000002', false),
    ('b4000000-0000-0000-0000-000000000004', 'Pasien Tiga B4', 'Citra', 'Ibu Citra', '081100000003', true)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    nama_panggilan = EXCLUDED.nama_panggilan,
    is_anonim_default = EXCLUDED.is_anonim_default;

-- 5. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('booking', '{"min_hours_before": 1, "max_days_ahead": 14, "max_active_per_patient": 3, "max_per_psikolog_per_day": 1, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. SETUP WALLETS PASIEN
-- Pasien 1: 100 koin (cukup untuk uji banyak booking)
-- Pasien 2: 30 koin (untuk uji slot bentrok)
-- Pasien 3: 10 koin (kurang dari tarif 15 koin, untuk uji INSUFFICIENT_COINS)
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('b4000000-0000-0000-0000-000000000002', 100, 0, 0),
    ('b4000000-0000-0000-0000-000000000003', 30, 0, 0),
    ('b4000000-0000-0000-0000-000000000004', 10, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET
    coin_balance = EXCLUDED.coin_balance,
    pending_rupiah = 0,
    available_rupiah = 0;

-- ========================================================
-- SALINAN PERSIS DDL DARI 20261017000012_bookings.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked' CHECK (
        status IN (
            'booked',
            'in_progress',
            'completed',
            'cancelled_by_patient',
            'cancelled_by_psikolog',
            'awaiting_patient_choice',
            'auto_cancelled_late',
            'no_show'
        )
    ),
    keluhan TEXT NOT NULL CHECK (
        pg_catalog.char_length(pg_catalog.btrim(keluhan)) >= 20 AND
        pg_catalog.char_length(keluhan) <= 1000
    ),
    price_coins INTEGER NOT NULL CHECK (price_coins > 0),
    mitra_share_bps INTEGER NOT NULL CHECK (mitra_share_bps >= 0 AND mitra_share_bps <= 10000),
    extension_price_coins INTEGER NULL CHECK (extension_price_coins IS NULL OR extension_price_coins > 0),
    refund_policy JSONB NOT NULL,
    patient_display_name TEXT NOT NULL,
    reschedule_count SMALLINT NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
    psikolog_first_msg_at TIMESTAMPTZ NULL,
    patient_first_msg_at TIMESTAMPTZ NULL,
    psikolog_late BOOLEAN NOT NULL DEFAULT false,
    extension_status TEXT NULL CHECK (
        extension_status IS NULL OR
        extension_status IN ('requested', 'approved', 'declined')
    ),
    extension_coins INTEGER NULL CHECK (extension_coins IS NULL OR extension_coins > 0),
    ended_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    choice_deadline_at TIMESTAMPTZ NULL,
    refund_coins INTEGER NOT NULL DEFAULT 0 CHECK (refund_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_idx
    ON public.bookings (psikolog_id, start_at)
    WHERE status IN ('booked', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_bookings_patient_id ON public.bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_psikolog_id ON public.bookings(psikolog_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON public.bookings(start_at);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_select_participant ON public.bookings;
CREATE POLICY bookings_select_participant ON public.bookings
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id OR
        auth.uid() = psikolog_id OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

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
    IF p_psikolog_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
        RETURN;
    END IF;

    SELECT (u.status = 'active'), p.booking_paused, p.suspended_until
    INTO v_is_active, v_booking_paused, v_suspended_until
    FROM public.users u
    JOIN public.psikolog_profiles p ON p.user_id = u.id
    WHERE u.id = p_psikolog_id AND u.role = 'psikolog';

    IF NOT FOUND OR NOT COALESCE(v_is_active, false) OR COALESCE(v_booking_paused, false) THEN
        RETURN;
    END IF;

    IF v_suspended_until IS NOT NULL AND v_suspended_until > pg_catalog.now() THEN
        RETURN;
    END IF;

    SELECT
        COALESCE((value->>'min_hours_before')::INTEGER, 2),
        COALESCE((value->>'max_days_ahead')::INTEGER, 14)
    INTO v_min_hours_before, v_max_days_ahead
    FROM public.system_settings
    WHERE key = 'booking';

    v_min_hours_before := COALESCE(v_min_hours_before, 2);
    v_max_days_ahead := COALESCE(v_max_days_ahead, 14);

    v_start_date := (p_from AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_end_date := (p_to AT TIME ZONE 'Asia/Jakarta')::DATE;

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
        SELECT ((days.d + (g.hour_num * INTERVAL '1 hour')) AT TIME ZONE 'Asia/Jakarta') AS slot
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
      AND NOT EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.psikolog_id = p_psikolog_id
            AND b.start_at = rs.slot
            AND b.status IN ('booked', 'in_progress')
      )
    ORDER BY rs.slot ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psikolog_available_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.booking_create(
    p_booking_id UUID,
    p_patient_id UUID,
    p_psikolog_id UUID,
    p_start_at TIMESTAMPTZ,
    p_keluhan TEXT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking_id UUID;
    v_patient_role public.user_role;
    v_patient_status public.account_status;
    v_patient_profile public.pasien_profiles%ROWTYPE;
    v_display_name TEXT;

    v_psikolog_role public.user_role;
    v_psikolog_status public.account_status;
    v_psikolog_profile public.psikolog_profiles%ROWTYPE;

    v_bps INTEGER;
    v_refund_policy JSONB;
    v_max_active INTEGER := 3;
    v_max_daily INTEGER := 1;
    v_price_coins INTEGER;
    v_active_count INTEGER;
    v_daily_count INTEGER;

    v_booking public.bookings%ROWTYPE;
BEGIN
    IF p_patient_id IS NULL OR p_psikolog_id IS NULL OR p_start_at IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    IF p_patient_id = p_psikolog_id THEN
        RAISE EXCEPTION 'CANNOT_BOOK_SELF' USING ERRCODE = '22023';
    END IF;

    IF p_keluhan IS NULL OR
       pg_catalog.char_length(pg_catalog.btrim(p_keluhan)) < 20 OR
       pg_catalog.char_length(p_keluhan) > 1000 THEN
        RAISE EXCEPTION 'INVALID_KELUHAN' USING ERRCODE = '22023';
    END IF;

    v_booking_id := COALESCE(p_booking_id, pg_catalog.gen_random_uuid());

    SELECT u.role, u.status INTO v_patient_role, v_patient_status
    FROM public.users u
    WHERE u.id = p_patient_id;

    IF v_patient_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_patient_role <> 'pasien'::public.user_role THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE = '42501';
    END IF;

    IF v_patient_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_patient_profile
    FROM public.pasien_profiles
    WHERE user_id = p_patient_id;

    IF COALESCE(v_patient_profile.is_anonim_default, false) THEN
        v_display_name := 'Pasien Anonim';
    ELSIF v_patient_profile.nama_panggilan IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(v_patient_profile.nama_panggilan)) > 0 THEN
        v_display_name := pg_catalog.btrim(v_patient_profile.nama_panggilan);
    ELSIF v_patient_profile.nama_lengkap IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(v_patient_profile.nama_lengkap)) > 0 THEN
        v_display_name := pg_catalog.split_part(pg_catalog.btrim(v_patient_profile.nama_lengkap), ' ', 1);
    ELSE
        v_display_name := 'Pasien Anonim';
    END IF;

    SELECT u.role, u.status INTO v_psikolog_role, v_psikolog_status
    FROM public.users u
    WHERE u.id = p_psikolog_id;

    IF v_psikolog_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_psikolog_role <> 'psikolog'::public.user_role OR v_psikolog_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'PSIKOLOG_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_psikolog_profile
    FROM public.psikolog_profiles
    WHERE user_id = p_psikolog_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PSIKOLOG_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_psikolog_profile.booking_paused, false) OR
       (v_psikolog_profile.suspended_until IS NOT NULL AND v_psikolog_profile.suspended_until > pg_catalog.now()) THEN
        RAISE EXCEPTION 'PSIKOLOG_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    v_price_coins := (v_psikolog_profile.tarif_sesi / 10000)::INTEGER;
    IF v_price_coins IS NULL OR v_price_coins <= 0 THEN
        RAISE EXCEPTION 'INVALID_TARIF_SESI' USING ERRCODE = '22023';
    END IF;

    SELECT (value->>'mitra_bps')::INTEGER
    INTO v_bps
    FROM public.system_settings
    WHERE key = 'revenue_share';
    v_bps := COALESCE(v_bps, 8500);

    SELECT value
    INTO v_refund_policy
    FROM public.system_settings
    WHERE key = 'refund_policy';
    IF v_refund_policy IS NULL THEN
        v_refund_policy := '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::JSONB;
    END IF;

    SELECT
        COALESCE((value->>'max_active_per_patient')::INTEGER, 3),
        COALESCE((value->>'max_per_psikolog_per_day')::INTEGER, 1)
    INTO v_max_active, v_max_daily
    FROM public.system_settings
    WHERE key = 'booking';
    v_max_active := COALESCE(v_max_active, 3);
    v_max_daily := COALESCE(v_max_daily, 1);

    SELECT pg_catalog.count(*)
    INTO v_active_count
    FROM public.bookings
    WHERE patient_id = p_patient_id
      AND status IN ('booked', 'in_progress');

    IF v_active_count >= v_max_active THEN
        RAISE EXCEPTION 'LIMIT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    SELECT pg_catalog.count(*)
    INTO v_daily_count
    FROM public.bookings
    WHERE patient_id = p_patient_id
      AND psikolog_id = p_psikolog_id
      AND (start_at AT TIME ZONE 'Asia/Jakarta')::DATE = (p_start_at AT TIME ZONE 'Asia/Jakarta')::DATE
      AND status IN ('booked', 'in_progress', 'completed', 'awaiting_patient_choice');

    IF v_daily_count >= v_max_daily THEN
        RAISE EXCEPTION 'LIMIT_DAILY' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.psikolog_available_slots(p_psikolog_id, p_start_at, p_start_at + INTERVAL '1 hour') s
        WHERE s = p_start_at
    ) THEN
        RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.apply_wallet_ledger_internal(
        p_patient_id,
        'patient_coins',
        -v_price_coins,
        'coin',
        'booking_payment',
        'booking',
        v_booking_id
    );

    BEGIN
        INSERT INTO public.bookings (
            id, patient_id, psikolog_id, start_at, status, keluhan,
            price_coins, mitra_share_bps, extension_price_coins, refund_policy,
            patient_display_name, reschedule_count, created_at, updated_at
        ) VALUES (
            v_booking_id, p_patient_id, p_psikolog_id, p_start_at, 'booked', p_keluhan,
            v_price_coins, v_bps, v_psikolog_profile.extension_price_coins, v_refund_policy,
            v_display_name, 0, pg_catalog.now(), pg_catalog.now()
        )
        RETURNING * INTO v_booking;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_create(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_create(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.booking_cancel_by_patient(
    p_booking_id UUID,
    p_patient_id UUID
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_minutes_before NUMERIC;
    v_refund_pct NUMERIC := 0;
    v_tier JSONB;
    v_refund_coins INTEGER := 0;
    v_burned_coins INTEGER := 0;
    v_gross BIGINT;
    v_mitra BIGINT;
    v_platform BIGINT;
    v_holding INTEGER := 48;
BEGIN
    IF p_booking_id IS NULL OR p_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status <> 'booked' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    v_minutes_before := EXTRACT(EPOCH FROM (v_booking.start_at - pg_catalog.now())) / 60.0;

    IF jsonb_typeof(v_booking.refund_policy) = 'array' THEN
        FOR v_tier IN
            SELECT value
            FROM jsonb_array_elements(v_booking.refund_policy)
            ORDER BY (value->>'min_minutes_before')::NUMERIC DESC
        LOOP
            IF v_minutes_before >= (v_tier->>'min_minutes_before')::NUMERIC THEN
                v_refund_pct := (v_tier->>'refund_pct')::NUMERIC;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    v_refund_coins := pg_catalog.ceil((v_booking.price_coins::NUMERIC * v_refund_pct) / 100.0)::INTEGER;
    IF v_refund_coins > v_booking.price_coins THEN
        v_refund_coins := v_booking.price_coins;
    END IF;
    IF v_refund_coins < 0 THEN
        v_refund_coins := 0;
    END IF;

    v_burned_coins := v_booking.price_coins - v_refund_coins;

    IF v_refund_coins > 0 THEN
        PERFORM public.apply_wallet_ledger_internal(
            p_patient_id,
            'patient_coins',
            v_refund_coins,
            'coin',
            'booking_refund',
            'booking',
            p_booking_id
        );
    END IF;

    IF v_burned_coins > 0 THEN
        v_gross := v_burned_coins * 10000;
        v_mitra := pg_catalog.floor((v_gross::NUMERIC * v_booking.mitra_share_bps) / 10000.0)::BIGINT;
        v_platform := v_gross - v_mitra;

        IF v_mitra + v_platform <> v_gross THEN
            RAISE EXCEPTION 'REFUND_SHARE_CONSERVATION_FAILED' USING ERRCODE = '23514';
        END IF;

        SELECT (value->>'hours')::INTEGER
        INTO v_holding
        FROM public.system_settings
        WHERE key = 'holding';
        v_holding := COALESCE(v_holding, 48);

        INSERT INTO public.wallets(user_id) VALUES(v_booking.psikolog_id) ON CONFLICT(user_id) DO NOTHING;
        PERFORM 1 FROM public.wallets WHERE user_id = v_booking.psikolog_id FOR UPDATE;

        IF v_mitra > 0 THEN
            UPDATE public.wallets
            SET pending_rupiah = pending_rupiah + v_mitra,
                updated_at = pg_catalog.now()
            WHERE user_id = v_booking.psikolog_id;

            INSERT INTO public.mitra_earnings(mitra_id, amount_rupiah, source_type, source_id, available_at)
            VALUES(v_booking.psikolog_id, v_mitra, 'refund_share', p_booking_id, pg_catalog.now() + (v_holding * INTERVAL '1 hour'));

            INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
            VALUES (v_booking.psikolog_id, 'mitra_pending', v_mitra, 'rupiah', 'refund_share_pending', 'booking', p_booking_id);
        END IF;

        IF v_platform > 0 THEN
            INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
            VALUES (NULL, 'platform_revenue', v_platform, 'rupiah', 'refund_share_platform', 'booking', p_booking_id);
        END IF;
    END IF;

    UPDATE public.bookings
    SET status = 'cancelled_by_patient',
        cancelled_at = pg_catalog.now(),
        refund_coins = v_refund_coins,
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_cancel_by_patient(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_cancel_by_patient(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.booking_reschedule(
    p_booking_id UUID,
    p_patient_id UUID,
    p_new_start_at TIMESTAMPTZ
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_reschedule_min_hours INTEGER := 24;
    v_max_daily INTEGER := 1;
    v_daily_count INTEGER;
    v_is_mode_a BOOLEAN := false;
BEGIN
    IF p_booking_id IS NULL OR p_patient_id IS NULL OR p_new_start_at IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    IF p_new_start_at = v_booking.start_at THEN
        RAISE EXCEPTION 'SAME_SLOT_SELECTED' USING ERRCODE = '22023';
    END IF;

    IF v_booking.status = 'booked' THEN
        v_is_mode_a := true;

        IF v_booking.reschedule_count >= 1 THEN
            RAISE EXCEPTION 'RESCHEDULE_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
        END IF;

        SELECT COALESCE((value->>'reschedule_min_hours')::INTEGER, 24)
        INTO v_reschedule_min_hours
        FROM public.system_settings
        WHERE key = 'booking';
        v_reschedule_min_hours := COALESCE(v_reschedule_min_hours, 24);

        IF (v_booking.start_at - pg_catalog.now()) <= (v_reschedule_min_hours * INTERVAL '1 hour') THEN
            RAISE EXCEPTION 'RESCHEDULE_TOO_LATE' USING ERRCODE = 'P0001';
        END IF;

    ELSIF v_booking.status = 'awaiting_patient_choice' THEN
        v_is_mode_a := false;
    ELSE
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE((value->>'max_per_psikolog_per_day')::INTEGER, 1)
    INTO v_max_daily
    FROM public.system_settings
    WHERE key = 'booking';
    v_max_daily := COALESCE(v_max_daily, 1);

    SELECT pg_catalog.count(*)
    INTO v_daily_count
    FROM public.bookings
    WHERE patient_id = p_patient_id
      AND psikolog_id = v_booking.psikolog_id
      AND id <> p_booking_id
      AND (start_at AT TIME ZONE 'Asia/Jakarta')::DATE = (p_new_start_at AT TIME ZONE 'Asia/Jakarta')::DATE
      AND status IN ('booked', 'in_progress', 'completed', 'awaiting_patient_choice');

    IF v_daily_count >= v_max_daily THEN
        RAISE EXCEPTION 'LIMIT_DAILY' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.psikolog_available_slots(v_booking.psikolog_id, p_new_start_at, p_new_start_at + INTERVAL '1 hour') s
        WHERE s = p_new_start_at
    ) THEN
        RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    BEGIN
        UPDATE public.bookings
        SET start_at = p_new_start_at,
            status = 'booked',
            reschedule_count = CASE WHEN v_is_mode_a THEN reschedule_count + 1 ELSE reschedule_count END,
            choice_deadline_at = NULL,
            updated_at = pg_catalog.now()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_reschedule(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_reschedule(UUID, UUID, TIMESTAMPTZ) TO service_role;

-- ========================================================
-- BLOK PENGUJIAN SKENARIO DRY-RUN (ASSERTIONS)
-- ========================================================

DO $$
DECLARE
    v_psikolog_id UUID := 'b4000000-0000-0000-0000-000000000001';
    v_pasien1_id UUID := 'b4000000-0000-0000-0000-000000000002';
    v_pasien2_id UUID := 'b4000000-0000-0000-0000-000000000003';
    v_pasien3_id UUID := 'b4000000-0000-0000-0000-000000000004';

    -- Basis waktu slot bulat WIB: sekarang + 25 jam (besok lusa, agar > 24 jam)
    v_base_slot TIMESTAMPTZ;
    v_slot_day1 TIMESTAMPTZ;
    v_slot_day1_b TIMESTAMPTZ;
    v_slot_day2 TIMESTAMPTZ;
    v_slot_day3 TIMESTAMPTZ;
    v_slot_day4 TIMESTAMPTZ;

    v_booking1 public.bookings;
    v_booking2 public.bookings;
    v_booking3 public.bookings;
    v_booking4 public.bookings;

    v_bal_pasien1 BIGINT;
    v_bal_pasien2 BIGINT;
    v_bal_pasien3 BIGINT;
    v_slot_count INTEGER;

    v_err_code TEXT;
    v_err_msg TEXT;

    v_mitra_earn BIGINT;
    v_platform_rev BIGINT;
    v_holding_hours INTEGER;
BEGIN
    -- Hitung slot jam bulat WIB yang aman dari batas min_hours_before dan < 14 hari
    v_base_slot := (pg_catalog.date_trunc('hour', pg_catalog.now() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '26 hours') AT TIME ZONE 'Asia/Jakarta';
    v_slot_day1 := v_base_slot;
    v_slot_day1_b := v_base_slot + INTERVAL '2 hours';
    v_slot_day2 := v_base_slot + INTERVAL '24 hours';
    v_slot_day3 := v_base_slot + INTERVAL '48 hours';
    v_slot_day4 := v_base_slot + INTERVAL '72 hours';

    -- ----------------------------------------------------
    -- UJI 1: Booking Pertama Sukses & Slot Hilang dari Generator
    -- ----------------------------------------------------
    SELECT pg_catalog.count(*) INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_slot_day1, v_slot_day1 + INTERVAL '1 hour') s
    WHERE s = v_slot_day1;

    IF v_slot_count <> 1 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Slot kandidat awal % harusnya tersedia di generator, ditemukan %', v_slot_day1, v_slot_count;
    END IF;

    -- Pasien 1 (saldo 100) memesan slot v_slot_day1 (tarif 15 koin)
    v_booking1 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot_day1,
        'Saya merasa cemas dan overthinking berlebihan sejak seminggu lalu.'
    );

    IF v_booking1.status <> 'booked' OR v_booking1.price_coins <> 15 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Status booking harus booked dan price_coins 15, dapat % / %', v_booking1.status, v_booking1.price_coins;
    END IF;

    SELECT coin_balance INTO v_bal_pasien1 FROM public.wallets WHERE user_id = v_pasien1_id;
    IF v_bal_pasien1 <> 85 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Saldo koin Pasien 1 harus terdebit 15 menjadi 85, ditemukan %', v_bal_pasien1;
    END IF;

    -- Assert slot yang sudah dibooking hilang dari psikolog_available_slots
    SELECT pg_catalog.count(*) INTO v_slot_count
    FROM public.psikolog_available_slots(v_psikolog_id, v_slot_day1, v_slot_day1 + INTERVAL '1 hour') s
    WHERE s = v_slot_day1;

    IF v_slot_count <> 0 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Slot % yang sudah dibooking harusnya hilang dari generator, ditemukan %', v_slot_day1, v_slot_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 2: Review Focus #1 - Booking Ganda di Slot Sama
    -- Pasien 2 (saldo 30) mencoba booking slot yang sama (v_slot_day1)
    -- Harap: Exception SLOT_UNAVAILABLE & saldo Pasien 2 tetap 30
    -- ----------------------------------------------------
    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_create(
            pg_catalog.gen_random_uuid(),
            v_pasien2_id,
            v_psikolog_id,
            v_slot_day1,
            'Keluhan pasien kedua yang mencoba memesan slot sama persis.'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'SLOT_UNAVAILABLE' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Booking ganda harus melempar SLOT_UNAVAILABLE, didapat: %', v_err_msg;
    END IF;

    SELECT coin_balance INTO v_bal_pasien2 FROM public.wallets WHERE user_id = v_pasien2_id;
    IF v_bal_pasien2 <> 30 THEN
        RAISE EXCEPTION 'UJI 2 GAGAL (Review Focus #1): Saldo Pasien 2 berubah menjadi %, harusnya tetap 30', v_bal_pasien2;
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: Review Focus #4 - Saldo Kurang (INSUFFICIENT_COINS)
    -- Pasien 3 (saldo 10 koin) mencoba booking tarif 15 koin
    -- Harap: Exception INSUFFICIENT_COINS, tanpa debit saldo, tanpa booking
    -- ----------------------------------------------------
    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_create(
            pg_catalog.gen_random_uuid(),
            v_pasien3_id,
            v_psikolog_id,
            v_slot_day2,
            'Keluhan pasien ketiga dengan saldo koin yang tidak mencukupi.'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'INSUFFICIENT_COINS' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL (Review Focus #4): Saldo kurang harus melempar INSUFFICIENT_COINS, didapat: %', v_err_msg;
    END IF;

    SELECT coin_balance INTO v_bal_pasien3 FROM public.wallets WHERE user_id = v_pasien3_id;
    IF v_bal_pasien3 <> 10 THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Saldo Pasien 3 terdebit menjadi %, harusnya tetap 10', v_bal_pasien3;
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: Batas Harian Pasien per Psikolog (LIMIT_DAILY)
    -- Pasien 1 mencoba booking slot kedua di hari WIB yang sama (v_slot_day1_b)
    -- ----------------------------------------------------
    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_create(
            pg_catalog.gen_random_uuid(),
            v_pasien1_id,
            v_psikolog_id,
            v_slot_day1_b,
            'Mencoba memesan sesi kedua di hari kalender yang sama persis.'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'LIMIT_DAILY' THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Booking kedua di hari sama harus melempar LIMIT_DAILY, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: Batas Booking Aktif (LIMIT_ACTIVE ke-4)
    -- Pasien 1 sudah punya 1 booking (v_slot_day1)
    -- Pasien 1 booking slot di hari 2 dan hari 3 -> total 3 booking aktif
    -- Booking ke-4 di hari 4 harus melempar LIMIT_ACTIVE
    -- ----------------------------------------------------
    v_booking2 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot_day2,
        'Booking kedua di hari berbeda untuk pengujian batas aktif konseling.'
    );

    v_booking3 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot_day3,
        'Booking ketiga di hari berbeda untuk pengujian batas aktif konseling.'
    );

    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_create(
            pg_catalog.gen_random_uuid(),
            v_pasien1_id,
            v_psikolog_id,
            v_slot_day4,
            'Booking keempat yang seharusnya melampaui batas aktif 3 booking.'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'LIMIT_ACTIVE' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Booking ke-4 aktif harus melempar LIMIT_ACTIVE, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 6: Pengujian Pembatalan Pasien & Refund Berdasarkan Jarak Waktu
    -- Snapshot: >= 60 mnt = 100%, 30..60 mnt = 65% (ceil), < 30 mnt = 0%
    -- ----------------------------------------------------

    -- 6a. Batal 90 Menit Sebelum Sesi -> Refund 100% (15 Koin)
    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '90 minutes'
    WHERE id = v_booking3.id;

    SELECT coin_balance INTO v_bal_pasien1 FROM public.wallets WHERE user_id = v_pasien1_id; -- sebelum refund

    v_booking3 := public.booking_cancel_by_patient(v_booking3.id, v_pasien1_id);

    IF v_booking3.status <> 'cancelled_by_patient' OR v_booking3.refund_coins <> 15 THEN
        RAISE EXCEPTION 'UJI 6a GAGAL: Batal 90 mnt harus refund_coins 15, dapat %', v_booking3.refund_coins;
    END IF;

    SELECT coin_balance INTO v_bal_pasien1 FROM public.wallets WHERE user_id = v_pasien1_id;
    -- Pasien 1 mendapat kembali 15 koin utuh

    -- 6b. Batal 45 Menit Sebelum Sesi -> Refund 65% Ceil(15 * 0.65) = 10 Koin
    -- Sisa koin dibakar: 5 koin = Rp 50.000. Mitra 85% = Rp 42.500, Platform = Rp 7.500
    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '45 minutes'
    WHERE id = v_booking2.id;

    v_booking2 := public.booking_cancel_by_patient(v_booking2.id, v_pasien1_id);

    IF v_booking2.status <> 'cancelled_by_patient' OR v_booking2.refund_coins <> 10 THEN
        RAISE EXCEPTION 'UJI 6b GAGAL: Batal 45 mnt harus refund_coins 10 (ceil 9.75), dapat %', v_booking2.refund_coins;
    END IF;

    -- Cek mitra_earnings dari koin hangus (source_type = 'refund_share')
    SELECT amount_rupiah INTO v_mitra_earn
    FROM public.mitra_earnings
    WHERE source_type = 'refund_share' AND source_id = v_booking2.id;

    IF v_mitra_earn <> 42500 THEN
        RAISE EXCEPTION 'UJI 6b GAGAL: Mitra share dari koin hangus harus Rp 42.500, didapat %', v_mitra_earn;
    END IF;

    -- Cek ledger platform_revenue
    SELECT amount INTO v_platform_rev
    FROM public.ledger_entries
    WHERE ref_type = 'booking' AND ref_id = v_booking2.id AND account = 'platform_revenue';

    IF v_platform_rev <> 7500 THEN
        RAISE EXCEPTION 'UJI 6b GAGAL: Platform share dari koin hangus harus Rp 7.500, didapat %', v_platform_rev;
    END IF;

    -- 6c. Batal 10 Menit Sebelum Sesi -> Refund 0% (0 Koin)
    -- Buat booking baru dulu untuk uji 6c
    v_booking4 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot_day4,
        'Booking untuk menguji pembatalan mendadak 10 menit sebelum konseling.'
    );

    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '10 minutes'
    WHERE id = v_booking4.id;

    v_booking4 := public.booking_cancel_by_patient(v_booking4.id, v_pasien1_id);

    IF v_booking4.status <> 'cancelled_by_patient' OR v_booking4.refund_coins <> 0 THEN
        RAISE EXCEPTION 'UJI 6c GAGAL: Batal 10 mnt harus refund_coins 0, dapat %', v_booking4.refund_coins;
    END IF;

    -- Seluruh 15 koin dibakar: 15 * 10000 = Rp 150.000. Mitra 85% = Rp 127.500, Platform = Rp 22.500
    SELECT amount_rupiah INTO v_mitra_earn
    FROM public.mitra_earnings
    WHERE source_type = 'refund_share' AND source_id = v_booking4.id;

    IF v_mitra_earn <> 127500 THEN
        RAISE EXCEPTION 'UJI 6c GAGAL: Mitra share hangus 100%% harus Rp 127.500, didapat %', v_mitra_earn;
    END IF;

    -- ----------------------------------------------------
    -- UJI 7: Pengujian Reschedule (Pindah Jadwal Mandiri Pasien)
    -- Aturan: Maks 1 kali, hanya jika > 24 jam sebelum sesi, slot baru tersedia
    -- ----------------------------------------------------

    -- 7a. Reschedule > 24 jam sebelum sesi (v_booking1 start_at diatur 30 jam dari sekarang)
    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '30 hours',
        reschedule_count = 0
    WHERE id = v_booking1.id;

    -- Pindah ke v_slot_day2 (yang sekarang kosong setelah v_booking2 dibatalkan)
    v_booking1 := public.booking_reschedule(v_booking1.id, v_pasien1_id, v_slot_day2);

    IF v_booking1.reschedule_count <> 1 OR v_booking1.start_at <> v_slot_day2 THEN
        RAISE EXCEPTION 'UJI 7a GAGAL: Reschedule pertama harus sukses dengan count = 1, dapat %', v_booking1.reschedule_count;
    END IF;

    -- 7b. Reschedule Kedua Kalinya -> Gagal (RESCHEDULE_LIMIT_EXCEEDED)
    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_reschedule(v_booking1.id, v_pasien1_id, v_slot_day3);
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'RESCHEDULE_LIMIT_EXCEEDED' THEN
        RAISE EXCEPTION 'UJI 7b GAGAL: Reschedule kedua kali harus melempar RESCHEDULE_LIMIT_EXCEEDED, didapat: %', v_err_msg;
    END IF;

    -- 7c. Reschedule < 24 jam sebelum sesi -> Gagal (RESCHEDULE_TOO_LATE)
    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '20 hours',
        reschedule_count = 0
    WHERE id = v_booking1.id;

    v_err_msg := NULL;
    BEGIN
        PERFORM public.booking_reschedule(v_booking1.id, v_pasien1_id, v_slot_day3);
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;

    IF v_err_msg IS NULL OR v_err_msg <> 'RESCHEDULE_TOO_LATE' THEN
        RAISE EXCEPTION 'UJI 7c GAGAL: Reschedule < 24 jam harus melempar RESCHEDULE_TOO_LATE, didapat: %', v_err_msg;
    END IF;

    RAISE NOTICE 'SEMUA UJI DRY-RUN TASK B4 BERHASIL DIVERIFIKASI DENGAN LENGKAP!';
END;
$$;

ROLLBACK;
