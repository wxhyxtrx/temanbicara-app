-- ========================================================
-- TEMAN BICARA: RATING, ULASAN SESI, TIP SESI & TICK RESILIENCE (FASE 3 - TASK B8)
-- Migration: 20261017000017_session_reviews.sql
-- ========================================================

-- 1. TABEL SESSION_REVIEWS
-- Menyimpan rating bintang (1-5) dan ulasan teks dari pasien setelah sesi konseling selesai.
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

COMMENT ON TABLE public.session_reviews IS 'Ulasan dan penilaian sesi konseling yang diberikan oleh pasien (maks 1 per booking)';
COMMENT ON COLUMN public.session_reviews.booking_id IS 'ID booking sesi terkait (primary key, 1 ulasan per booking)';
COMMENT ON COLUMN public.session_reviews.patient_id IS 'ID pasien yang memberikan rating';
COMMENT ON COLUMN public.session_reviews.psikolog_id IS 'ID psikolog yang dinilai';
COMMENT ON COLUMN public.session_reviews.rating IS 'Skor rating bintang 1 hingga 5';
COMMENT ON COLUMN public.session_reviews.review IS 'Teks ulasan bebas (maksimal 500 karakter, tanpa info pribadi)';
COMMENT ON COLUMN public.session_reviews.is_hidden IS 'Status moderasi admin (true jika disembunyikan dari tampilan publik)';
COMMENT ON COLUMN public.session_reviews.reported_at IS 'Waktu pelaporan ulasan oleh psikolog ke admin moderasi';

-- Indexes untuk query performa
CREATE INDEX IF NOT EXISTS idx_session_reviews_psikolog_created
    ON public.session_reviews(psikolog_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_reviews_patient
    ON public.session_reviews(patient_id);

CREATE INDEX IF NOT EXISTS idx_session_reviews_psikolog_public
    ON public.session_reviews(psikolog_id, created_at DESC)
    WHERE is_hidden = false;

-- RLS: Peserta booking (pasien/psikolog) dan admin dapat membaca baris ulasan.
-- Seluruh mutasi tulis (INSERT/UPDATE/DELETE) dibatasi hanya via RPC service_role.
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
-- Pasien mengisi atau memperbarui rating & ulasan untuk sesi yang berstatus completed.
-- Hanya diizinkan dalam rentang rating.window_days sejak ended_at sesi.
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

COMMENT ON FUNCTION public.review_upsert(UUID, UUID, SMALLINT, TEXT) IS 'Membuat atau memperbarui rating dan ulasan pasien untuk sesi yang telah selesai dalam jendela evaluasi';


-- 3. RPC SESSION TIP
-- Pasien memberikan tip berupa koin kepada psikolog untuk sesi yang telah berstatus completed.
-- Memastikan booking milik pasien, completed, dalam rating.window_days, lalu memanggil tip_create() eksisting.
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

    -- Panggil tip_create dari subsistem wallet (Phase 2)
    -- tip_create(p_tip_id UUID, p_patient_id UUID, p_mitra_id UUID, p_coins BIGINT, p_source_type TEXT, p_source_id UUID)
    -- Constraint tips_source_once di tabel tips akan otomatis menolak tip ganda untuk booking yang sama.
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

COMMENT ON FUNCTION public.session_tip(UUID, UUID, UUID, BIGINT) IS 'Memberikan tip koin dari pasien kepada psikolog untuk sesi yang telah selesai dalam jendela evaluasi';


-- 4. RPC REVIEW REPORT (PSIKOLOG)
-- Psikolog menandai ulasan sesi yang dirasa tidak pantas / melanggar kebijakan untuk dimoderasi admin.
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

COMMENT ON FUNCTION public.review_report(UUID, UUID) IS 'Melaporkan ulasan sesi ke admin oleh psikolog terkait';


-- 5. RPC REVIEW SET HIDDEN (ADMIN)
-- Admin moderasi menyembunyikan atau menampilkan ulasan publik.
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

COMMENT ON FUNCTION public.review_set_hidden(UUID, BOOLEAN) IS 'Mengubah status sembunyikan ulasan oleh admin';


-- 6. HELPER FUNCTION RATING SUMMARY PSIKOLOG
-- Menghitung agregat rating: rata-rata hanya jika count >= min_count_to_show, exclude hidden.
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

COMMENT ON FUNCTION public.psikolog_rating_summary(UUID) IS 'Menghasilkan rating_avg dan rating_count psikolog sesuai batas min_count_to_show';


-- 7. PERBAIKAN FUNCTION SESSION_TICK (RESILIENCE SETIAP BARIS)
-- Evaluasi siklus timer otomatis dengan blok penanganan exception per booking agar error pada satu booking tidak menggagalkan seluruh tick.
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

COMMENT ON FUNCTION public.session_tick() IS 'Timer periodic pemrosesan transisi siklus sesi konseling dan settlement otomatis (resilient per-row exception)';
