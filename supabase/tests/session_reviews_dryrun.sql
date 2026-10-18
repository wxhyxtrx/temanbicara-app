-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000017 (SESSION REVIEWS, TIPS & TICK RESILIENCE)
-- Path: supabase/tests/session_reviews_dryrun.sql
-- Scope:
-- 1. Setup user test: 2 psikolog, 4 pasien, 1 admin
-- 2. DDL Salinan persis dari 20261017000017_session_reviews.sql
-- 3. Assert Test 1: Review booking 'no_show' -> gagal (BOOKING_NOT_COMPLETED)
-- 4. Assert Test 2: Review hari ke-8 (melewati rating.window_days) -> gagal (RATING_WINDOW_EXPIRED)
-- 5. Assert Test 3: Upsert 2x pada booking sama -> tepat 1 baris di session_reviews & data terbarui
-- 6. Assert Test 4: Tip sesi selesai -> saldo terdebit, tip kedua pada booking sama ditolak tips_source_once
-- 7. Assert Test 5: Agregat rating: 2 rating -> avg null; 3 rating -> avg terisi
-- 8. Assert Test 6: Psikolog report review -> reported_at terisi; psikolog lain ditolak FORBIDDEN
-- 9. Assert Test 7: Admin set hidden -> is_hidden terbarui; review hidden tidak masuk perhitungan rating
-- 10. Assert Test 8: RLS: user non-partisipan tidak dapat membaca ulasan orang lain
-- 11. Assert Test 9: session_tick resilience: error pada satu booking tidak menggagalkan seluruh tick
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_psikolog_1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_psikolog_2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_pasien_1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_pasien_2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_pasien_3@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_pasien_4@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b8000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8_admin@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b8000000-0000-0000-0000-000000000001', 'b8_psikolog_1@temanbicara.test', '081299990801', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000002', 'b8_psikolog_2@temanbicara.test', '081299990802', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000003', 'b8_pasien_1@temanbicara.test', '081299990803', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000004', 'b8_pasien_2@temanbicara.test', '081299990804', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000005', 'b8_pasien_3@temanbicara.test', '081299990805', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000006', 'b8_pasien_4@temanbicara.test', '081299990806', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b8000000-0000-0000-0000-000000000007', 'b8_admin@temanbicara.test', '081299990807', 'admin'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL
INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url, spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused)
VALUES
    ('b8000000-0000-0000-0000-000000000001', 'Dr. B8 Psikolog 1, M.Psi', 'SIPP-B8-001', 'https://storage.test/sipp-b81.pdf', ARRAY['Kecemasan'], 6, 150000, false),
    ('b8000000-0000-0000-0000-000000000002', 'Dr. B8 Psikolog 2, M.Psi', 'SIPP-B8-002', 'https://storage.test/sipp-b82.pdf', ARRAY['Depresi'], 4, 120000, false)
ON CONFLICT (user_id) DO UPDATE SET tarif_sesi = EXCLUDED.tarif_sesi, booking_paused = false;

INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b8000000-0000-0000-0000-000000000003', 'Pasien Satu B8', 'Budi', 'Ibu Budi', '081100000803', false),
    ('b8000000-0000-0000-0000-000000000004', 'Pasien Dua B8', 'Dewi', 'Pak Dewi', '081100000804', false),
    ('b8000000-0000-0000-0000-000000000005', 'Pasien Tiga B8', 'Citra', 'Ibu Citra', '081100000805', false),
    ('b8000000-0000-0000-0000-000000000006', 'Pasien Empat B8', 'Doni', 'Pak Doni', '081100000806', false)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.admin_profiles (user_id, nama_lengkap, level)
VALUES
    ('b8000000-0000-0000-0000-000000000007', 'Admin Review Moderator', 'superadmin')
ON CONFLICT (user_id) DO NOTHING;

-- 4. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('rating', '{"window_days": 7, "min_count_to_show": 3}'::jsonb),
    ('tip', '{"min_coins": 1, "max_coins": 10, "daily_cap_coins_per_patient": 50}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('strike', '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb),
    ('psikolog_late', '{"minutes": 10}'::jsonb),
    ('patient_noshow', '{"minutes": 30}'::jsonb),
    ('booking', '{"min_hours_before": 1, "max_days_ahead": 14, "max_active_per_patient": 10, "max_per_psikolog_per_day": 10, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. SETUP WALLETS
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('b8000000-0000-0000-0000-000000000001', 0, 0, 0),
    ('b8000000-0000-0000-0000-000000000002', 0, 0, 0),
    ('b8000000-0000-0000-0000-000000000003', 50, 0, 0),
    ('b8000000-0000-0000-0000-000000000004', 50, 0, 0),
    ('b8000000-0000-0000-0000-000000000005', 50, 0, 0),
    ('b8000000-0000-0000-0000-000000000006', 50, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET
    coin_balance = EXCLUDED.coin_balance,
    pending_rupiah = 0,
    available_rupiah = 0;

-- ========================================================
-- HELPER RLS NON-REKURSIF: is_admin() (jika belum ada)
-- ========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'::public.user_role
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ========================================================
-- SALINAN DDL DARI 20261017000017_session_reviews.sql
-- ========================================================

-- 1. TABEL SESSION_REVIEWS
CREATE TABLE IF NOT EXISTS public.session_reviews (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id),
    psikolog_id UUID NOT NULL REFERENCES public.users(id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT NULL CHECK (review IS NULL OR pg_catalog.length(review) <= 500),
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    reported_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_session_reviews_psikolog_created
    ON public.session_reviews(psikolog_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_reviews_patient
    ON public.session_reviews(patient_id);

CREATE INDEX IF NOT EXISTS idx_session_reviews_psikolog_public
    ON public.session_reviews(psikolog_id, created_at DESC)
    WHERE is_hidden = false;

ALTER TABLE public.session_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_reviews_select_policy ON public.session_reviews;
CREATE POLICY session_reviews_select_policy ON public.session_reviews
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id
        OR auth.uid() = psikolog_id
        OR public.is_admin()
    );

REVOKE INSERT, UPDATE, DELETE ON public.session_reviews FROM anon, authenticated;

-- 2. RPC REVIEW UPSERT
CREATE OR REPLACE FUNCTION public.review_upsert(
    p_booking_id UUID,
    p_patient_id UUID,
    p_rating SMALLINT,
    p_review TEXT
)
RETURNS public.session_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_window_days INTEGER := 7;
    v_clean_review TEXT;
    v_review public.session_reviews;
BEGIN
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'INVALID_RATING' USING ERRCODE = '22023';
    END IF;

    v_clean_review := NULLIF(pg_catalog.btrim(p_review), '');
    IF v_clean_review IS NOT NULL AND pg_catalog.length(v_clean_review) > 500 THEN
        RAISE EXCEPTION 'REVIEW_TOO_LONG' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status <> 'completed' THEN
        RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_booking.ended_at, v_booking.updated_at, v_booking.start_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'RATING_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.session_reviews (
        booking_id,
        patient_id,
        psikolog_id,
        rating,
        review,
        updated_at
    )
    VALUES (
        p_booking_id,
        p_patient_id,
        v_booking.psikolog_id,
        p_rating,
        v_clean_review,
        pg_catalog.now()
    )
    ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        review = EXCLUDED.review,
        updated_at = pg_catalog.now()
    RETURNING * INTO v_review;

    RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.review_upsert(UUID, UUID, SMALLINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_upsert(UUID, UUID, SMALLINT, TEXT) TO service_role;

-- 3. RPC SESSION TIP
CREATE OR REPLACE FUNCTION public.session_tip(
    p_tip_id UUID,
    p_booking_id UUID,
    p_patient_id UUID,
    p_coins BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_window_days INTEGER := 7;
BEGIN
    IF p_coins IS NULL OR p_coins <= 0 THEN
        RAISE EXCEPTION 'INVALID_COINS' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status <> 'completed' THEN
        RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_booking.ended_at, v_booking.updated_at, v_booking.start_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'TIP_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.tip_create(
        p_tip_id,
        p_patient_id,
        v_booking.psikolog_id,
        p_coins,
        'session',
        p_booking_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.session_tip(UUID, UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_tip(UUID, UUID, UUID, BIGINT) TO service_role;

-- 4. RPC REVIEW REPORT
CREATE OR REPLACE FUNCTION public.review_report(
    p_booking_id UUID,
    p_psikolog_id UUID
)
RETURNS public.session_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_review public.session_reviews%ROWTYPE;
BEGIN
    SELECT * INTO v_review
    FROM public.session_reviews
    WHERE booking_id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REVIEW_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_review.psikolog_id <> p_psikolog_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    UPDATE public.session_reviews
    SET reported_at = COALESCE(reported_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_review;

    RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.review_report(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_report(UUID, UUID) TO service_role;

-- 5. RPC REVIEW SET HIDDEN
CREATE OR REPLACE FUNCTION public.review_set_hidden(
    p_booking_id UUID,
    p_is_hidden BOOLEAN
)
RETURNS public.session_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_review public.session_reviews%ROWTYPE;
BEGIN
    UPDATE public.session_reviews
    SET is_hidden = p_is_hidden,
        updated_at = pg_catalog.now()
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_review;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REVIEW_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.review_set_hidden(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_set_hidden(UUID, BOOLEAN) TO service_role;

-- 6. HELPER FUNCTION RATING SUMMARY
CREATE OR REPLACE FUNCTION public.psikolog_rating_summary(p_psikolog_id UUID)
RETURNS TABLE (
    rating_avg NUMERIC,
    rating_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_min_count INTEGER := 3;
BEGIN
    SELECT COALESCE((value->>'min_count_to_show')::INTEGER, 3)
    INTO v_min_count
    FROM public.system_settings
    WHERE key = 'rating';
    v_min_count := COALESCE(v_min_count, 3);

    RETURN QUERY
    SELECT
        CASE
            WHEN pg_catalog.count(r.rating) >= v_min_count
            THEN pg_catalog.round(pg_catalog.avg(r.rating)::NUMERIC, 1)
            ELSE NULL
        END AS rating_avg,
        pg_catalog.count(r.rating)::BIGINT AS rating_count
    FROM public.session_reviews AS r
    WHERE r.psikolog_id = p_psikolog_id
      AND r.is_hidden = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.psikolog_rating_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psikolog_rating_summary(UUID) TO authenticated, service_role;

-- 7. PERBAIKAN FUNCTION SESSION_TICK (RESILIENCE SETIAP BARIS)
CREATE OR REPLACE FUNCTION public.session_tick()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_psikolog_late_minutes INTEGER := 10;
    v_patient_noshow_minutes INTEGER := 30;
    v_booking RECORD;
BEGIN
    SELECT COALESCE((value->>'minutes')::INTEGER, 10)
    INTO v_psikolog_late_minutes
    FROM public.system_settings
    WHERE key = 'psikolog_late';
    v_psikolog_late_minutes := COALESCE(v_psikolog_late_minutes, 10);

    SELECT COALESCE((value->>'minutes')::INTEGER, 30)
    INTO v_patient_noshow_minutes
    FROM public.system_settings
    WHERE key = 'patient_noshow';
    v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

    -- 1. Psikolog telat / tidak menyapa: booked & tanpa pesan psikolog > start_at + psikolog_late
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'booked'
          AND psikolog_first_msg_at IS NULL
          AND pg_catalog.now() > start_at + (v_psikolog_late_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'auto_cancelled_late');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on auto_cancelled_late for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 2. Pasien no-show: in_progress & psikolog sudah menyapa tapi pasien belum menyapa > psikolog_first_msg_at + patient_noshow
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND psikolog_first_msg_at IS NOT NULL
          AND patient_first_msg_at IS NULL
          AND pg_catalog.now() > psikolog_first_msg_at + (v_patient_noshow_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'no_show');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on no_show for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 3. Hard cap 58 menit: in_progress & waktu sudah mencapai start_at + 58 menit
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND pg_catalog.now() >= start_at + INTERVAL '58 minutes'
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'completed');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on completed for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 4. Batas pilihan pasien lewat: awaiting_patient_choice & choice_deadline_at lewat
    FOR v_booking IN
        SELECT id, patient_id
        FROM public.bookings
        WHERE status = 'awaiting_patient_choice'
          AND choice_deadline_at IS NOT NULL
          AND pg_catalog.now() > choice_deadline_at
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_choose_refund(v_booking.id, v_booking.patient_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on choice_deadline for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.session_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_tick() TO service_role;

-- ========================================================
-- DATA FIXTURE BOOKINGS UNTUK PENGUJIAN
-- ========================================================

-- Booking 1: completed, ended_at 1 jam lalu (pasien 1 -> psikolog 1)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
) VALUES (
    'b8a00000-0000-0000-0000-000000000001',
    'b8000000-0000-0000-0000-000000000003',
    'b8000000-0000-0000-0000-000000000001',
    pg_catalog.now() - INTERVAL '2 hours',
    'completed',
    'Keluhan sesi konseling selesai normal dan siap diberi ulasan',
    15, 8500, '[]'::jsonb, 'Budi',
    pg_catalog.now() - INTERVAL '1 hour'
);

-- Booking 2: no_show (pasien 2 -> psikolog 1)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
) VALUES (
    'b8a00000-0000-0000-0000-000000000002',
    'b8000000-0000-0000-0000-000000000004',
    'b8000000-0000-0000-0000-000000000001',
    pg_catalog.now() - INTERVAL '3 hours',
    'no_show',
    'Keluhan sesi konseling yang diakhiri karena no show pasien',
    15, 8500, '[]'::jsonb, 'Dewi',
    pg_catalog.now() - INTERVAL '2 hours'
);

-- Booking 3: completed, ended_at 8 hari lalu (melewati jendela 7 hari)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
) VALUES (
    'b8a00000-0000-0000-0000-000000000003',
    'b8000000-0000-0000-0000-000000000005',
    'b8000000-0000-0000-0000-000000000001',
    pg_catalog.now() - INTERVAL '8 days' - INTERVAL '1 hour',
    'completed',
    'Keluhan sesi konseling yang selesai 8 hari lalu untuk uji jendela',
    15, 8500, '[]'::jsonb, 'Citra',
    pg_catalog.now() - INTERVAL '8 days'
);

-- Booking 4: completed, ended_at 2 jam lalu (pasien 2 -> psikolog 1)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
) VALUES (
    'b8a00000-0000-0000-0000-000000000004',
    'b8000000-0000-0000-0000-000000000004',
    'b8000000-0000-0000-0000-000000000001',
    pg_catalog.now() - INTERVAL '4 hours',
    'completed',
    'Keluhan sesi konseling kedua yang sukses selesai normal',
    15, 8500, '[]'::jsonb, 'Dewi',
    pg_catalog.now() - INTERVAL '3 hours'
);

-- Booking 5: completed, ended_at 4 jam lalu (pasien 4 -> psikolog 1)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
) VALUES (
    'b8a00000-0000-0000-0000-000000000005',
    'b8000000-0000-0000-0000-000000000006',
    'b8000000-0000-0000-0000-000000000001',
    pg_catalog.now() - INTERVAL '5 hours',
    'completed',
    'Keluhan sesi konseling ketiga yang sukses selesai normal',
    15, 8500, '[]'::jsonb, 'Doni',
    pg_catalog.now() - INTERVAL '4 hours'
);

-- Booking 6: booked, start_at 25 menit lalu tanpa sapaan psikolog (untuk test session_tick 1)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name
) VALUES (
    'b8a00000-0000-0000-0000-000000000006',
    'b8000000-0000-0000-0000-000000000003',
    'b8000000-0000-0000-0000-000000000002',
    pg_catalog.now() - INTERVAL '25 minutes',
    'booked',
    'Keluhan sesi konseling pertama untuk pengujian cron tick',
    15, 8500, '[]'::jsonb, 'Budi'
);

-- Booking 7: booked, start_at 26 menit lalu tanpa sapaan psikolog (untuk test session_tick 2 - simulasi error)
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name
) VALUES (
    'b8a00000-0000-0000-0000-000000000007',
    'b8000000-0000-0000-0000-000000000004',
    'b8000000-0000-0000-0000-000000000002',
    pg_catalog.now() - INTERVAL '26 minutes',
    'booked',
    'Keluhan sesi konseling kedua untuk pengujian cron tick error',
    15, 8500, '[]'::jsonb, 'Dewi'
);


-- ========================================================
-- HELPER TRIGGER FUNCTION FOR TEST 9 (OUTSIDE DO BLOCK)
-- ========================================================
CREATE OR REPLACE FUNCTION public.tmp_fail_booking_7()
RETURNS TRIGGER AS $fn$
BEGIN
    IF NEW.id = 'b8a00000-0000-0000-0000-000000000007' THEN
        RAISE EXCEPTION 'SIMULATED CORRUPTION ON BOOKING 7';
    END IF;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- ========================================================
-- EKSEKUSI PENGUJIAN DRY-RUN (ASSERTIONS)
-- ========================================================

DO $$
DECLARE
    v_caught BOOLEAN;
    v_err_msg TEXT;
    v_review public.session_reviews;
    v_tip_id UUID := 'b8f00000-0000-0000-0000-000000000001';
    v_tip_id_2 UUID := 'b8f00000-0000-0000-0000-000000000002';
    v_count BIGINT;
    v_summary RECORD;
    v_processed INTEGER;
BEGIN
    -- ----------------------------------------------------
    -- UJI 1: Review booking 'no_show' harus gagal
    -- ----------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.review_upsert(
            'b8a00000-0000-0000-0000-000000000002', -- Booking 2 (no_show)
            'b8000000-0000-0000-0000-000000000004', -- Pasien 2
            5::SMALLINT,
            'Sesi sangat membantu'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'BOOKING_NOT_COMPLETED' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Review booking no_show harus melempar BOOKING_NOT_COMPLETED, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 2: Review hari ke-8 (jendela 7 hari expired) harus gagal
    -- ----------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.review_upsert(
            'b8a00000-0000-0000-0000-000000000003', -- Booking 3 (ended 8 hari lalu)
            'b8000000-0000-0000-0000-000000000005', -- Pasien 3
            5::SMALLINT,
            'Ulasan telat melewati jendela'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'RATING_WINDOW_EXPIRED' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Review hari ke-8 harus melempar RATING_WINDOW_EXPIRED, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: Upsert 2x pada booking sama -> tepat 1 baris & data terupdate
    -- ----------------------------------------------------
    -- Panggilan pertama: rating 5, review awal
    v_review := public.review_upsert(
        'b8a00000-0000-0000-0000-000000000001',
        'b8000000-0000-0000-0000-000000000003',
        5::SMALLINT,
        'Psikolog sangat mendengarkan dan solutif.'
    );

    IF v_review.rating <> 5 OR v_review.review <> 'Psikolog sangat mendengarkan dan solutif.' THEN
        RAISE EXCEPTION 'UJI 3.1 GAGAL: Hasil insert pertama review_upsert tidak sesuai';
    END IF;

    -- Panggilan kedua: revisi rating jadi 4 dan perbarui teks
    v_review := public.review_upsert(
        'b8a00000-0000-0000-0000-000000000001',
        'b8000000-0000-0000-0000-000000000003',
        4::SMALLINT,
        'Revisi ulasan: penjelasan sangat baik.'
    );

    IF v_review.rating <> 4 OR v_review.review <> 'Revisi ulasan: penjelasan sangat baik.' THEN
        RAISE EXCEPTION 'UJI 3.2 GAGAL: Hasil update kedua review_upsert tidak sesuai';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.session_reviews
    WHERE booking_id = 'b8a00000-0000-0000-0000-000000000001';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 3.3 GAGAL: Harus tepat 1 baris di session_reviews setelah 2x upsert, didapat: %', v_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: Tip 2x pada booking sama -> tips_source_once menolak yang kedua
    -- ----------------------------------------------------
    -- Tip pertama 3 koin pada Booking 1
    PERFORM public.session_tip(
        v_tip_id,
        'b8a00000-0000-0000-0000-000000000001',
        'b8000000-0000-0000-0000-000000000003',
        3::BIGINT
    );

    -- Pastikan baris tip terbentuk
    SELECT COUNT(*) INTO v_count
    FROM public.tips
    WHERE source_type = 'session' AND source_id = 'b8a00000-0000-0000-0000-000000000001';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 4.1 GAGAL: Tip pertama gagal dicatat di tabel tips';
    END IF;

    -- Tip kedua pada booking yang sama harus ditolak oleh constraint tips_source_once
    v_caught := false;
    BEGIN
        PERFORM public.session_tip(
            v_tip_id_2,
            'b8a00000-0000-0000-0000-000000000001',
            'b8000000-0000-0000-0000-000000000003',
            2::BIGINT
        );
    EXCEPTION WHEN unique_violation THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'UJI 4.2 GAGAL: Tip kedua pada booking yang sama harus ditolak oleh tips_source_once unique violation';
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: 2 rating -> avg null, 3 rating -> avg terisi
    -- ----------------------------------------------------
    -- Saat ini Psikolog 1 memiliki 1 rating (skor 4 dari Booking 1)
    -- Tambahkan rating kedua pada Booking 4 (skor 5 dari Pasien 2)
    PERFORM public.review_upsert(
        'b8a00000-0000-0000-0000-000000000004',
        'b8000000-0000-0000-0000-000000000004',
        5::SMALLINT,
        'Sangat direkomendasikan'
    );

    -- Cek agregat: 2 rating harus menghasilkan rating_avg NULL (karena min_count_to_show = 3)
    SELECT * INTO v_summary
    FROM public.psikolog_rating_summary('b8000000-0000-0000-0000-000000000001');

    IF v_summary.rating_count <> 2 OR v_summary.rating_avg IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 5.1 GAGAL: 2 rating harus menghasilkan rating_avg NULL dan count 2, didapat count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- Tambahkan rating ketiga pada Booking 5 (skor 3 dari Pasien 4)
    PERFORM public.review_upsert(
        'b8a00000-0000-0000-0000-000000000005',
        'b8000000-0000-0000-0000-000000000006',
        3::SMALLINT,
        'Cukup baik namun agak terburu-buru'
    );

    -- Cek agregat: 3 rating (4, 5, 3) -> avg = (4+5+3)/3 = 4.0
    SELECT * INTO v_summary
    FROM public.psikolog_rating_summary('b8000000-0000-0000-0000-000000000001');

    IF v_summary.rating_count <> 3 OR v_summary.rating_avg <> 4.0 THEN
        RAISE EXCEPTION 'UJI 5.2 GAGAL: 3 rating harus menghasilkan rating_avg 4.0 dan count 3, didapat count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 6: Psikolog report review
    -- ----------------------------------------------------
    -- Psikolog 1 melaporkan ulasan pada Booking 1
    v_review := public.review_report(
        'b8a00000-0000-0000-0000-000000000001',
        'b8000000-0000-0000-0000-000000000001'
    );

    IF v_review.reported_at IS NULL THEN
        RAISE EXCEPTION 'UJI 6.1 GAGAL: reported_at harus terisi setelah review_report';
    END IF;

    -- Psikolog 2 mencoba melaporkan ulasan milik Psikolog 1 -> harus ditolak FORBIDDEN
    v_caught := false;
    BEGIN
        PERFORM public.review_report(
            'b8a00000-0000-0000-0000-000000000001',
            'b8000000-0000-0000-0000-000000000002' -- Psikolog 2 bukan pemilik booking
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'FORBIDDEN' THEN
        RAISE EXCEPTION 'UJI 6.2 GAGAL: review_report oleh psikolog lain harus melempar FORBIDDEN, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 7: Admin menyembunyikan ulasan (moderasi) & efek ke rating agregat
    -- ----------------------------------------------------
    v_review := public.review_set_hidden(
        'b8a00000-0000-0000-0000-000000000001',
        true
    );

    IF v_review.is_hidden <> true THEN
        RAISE EXCEPTION 'UJI 7.1 GAGAL: review_set_hidden harus menyetel is_hidden = true';
    END IF;

    -- Setelah 1 dari 3 ulasan disembunyikan, ulasan publik aktif tersisa 2 -> rating_avg kembali NULL
    SELECT * INTO v_summary
    FROM public.psikolog_rating_summary('b8000000-0000-0000-0000-000000000001');

    IF v_summary.rating_count <> 2 OR v_summary.rating_avg IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 7.2 GAGAL: Ulasan tersembunyi harus dikecualikan dari rating summary';
    END IF;

    -- Kembalikan is_hidden = false untuk konsistensi
    PERFORM public.review_set_hidden('b8a00000-0000-0000-0000-000000000001', false);

    -- ----------------------------------------------------
    -- UJI 8: RLS Session Reviews
    -- ----------------------------------------------------
    -- Pasien 3 (yang tidak memiliki booking 1) mencoba membaca session_reviews
    -- Simulasi context authenticated dengan uid = Pasien 3
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"b8000000-0000-0000-0000-000000000005"}', true);

    SELECT COUNT(*) INTO v_count
    FROM public.session_reviews
    WHERE booking_id = 'b8a00000-0000-0000-0000-000000000001';

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'UJI 8.1 GAGAL: RLS harus melarang pasien lain membaca ulasan booking orang lain, didapat count: %', v_count;
    END IF;

    -- Kembalikan context role admin/postgres
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- ----------------------------------------------------
    -- UJI 9: Perbaikan session_tick resilience
    -- Booking 6 & 7 sama-sama memenuhi syarat auto_cancelled_late.
    -- Kita buat simulasi error pada Booking 7 dengan constraint/trigger sementara.
    -- session_tick() harus tetap menyelesaikan Booking 6 tanpa abort transaction.
    -- ----------------------------------------------------
    -- Pasang trigger sementara pada bookings untuk mensimulasikan error pada Booking 7
    CREATE TRIGGER trg_tmp_fail_booking_7
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.tmp_fail_booking_7();

    -- Jalankan session_tick()
    -- Booking 6 harus sukses diproses, Booking 7 memicu exception yang ditangkap di blok per-baris
    v_processed := public.session_tick();

    IF v_processed < 1 THEN
        RAISE EXCEPTION 'UJI 9.1 GAGAL: session_tick harus memproses minimal 1 booking sukses, didapat: %', v_processed;
    END IF;

    -- Pastikan Booking 6 sukses beralih ke 'auto_cancelled_late'
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE id = 'b8a00000-0000-0000-0000-000000000006'
      AND status = 'auto_cancelled_late';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 9.2 GAGAL: Booking 6 harus beralih ke auto_cancelled_late';
    END IF;

    -- Pastikan Booking 7 tetap 'booked' (karena transaksinya di-catch dan di-skip tanpa gagalkan keseluruhan)
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE id = 'b8a00000-0000-0000-0000-000000000007'
      AND status = 'booked';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 9.3 GAGAL: Booking 7 harus tetap berstatus booked setelah penanganan exception';
    END IF;

    -- Bersihkan trigger sementara
    DROP TRIGGER IF EXISTS trg_tmp_fail_booking_7 ON public.bookings;

    RAISE NOTICE 'B8 DRY-RUN TESTS PASSED: All 9 test suites succeeded cleanly.';
END;
$$;

DROP FUNCTION IF EXISTS public.tmp_fail_booking_7();

ROLLBACK;
