-- ========================================================
-- TEMAN BICARA: PENUTUPAN TIKET, ULASAN & TIP RELAWAN SEBAYA (PRD-016)
-- Migration: 20261022000024_peer_closure_reviews.sql
-- ========================================================

-- 1. PEMBARUAN KOLOM PUBLIC.PEER_TICKETS
-- Tambah kolom closed_by untuk mencatat aktor penutup sesi (pasien, relawan, atau system)
ALTER TABLE public.peer_tickets
    ADD COLUMN IF NOT EXISTS closed_by TEXT NULL
    CHECK (closed_by IN ('pasien', 'relawan', 'system'));

COMMENT ON COLUMN public.peer_tickets.closed_by IS 'Pihak yang menutup tiket: pasien, relawan, atau system (timeout 24 jam)';

-- 2. TABEL PUBLIC.PEER_REVIEWS
-- Menyimpan ulasan bintang (1-5) dan teks ulasan dari pasien untuk relawan sebaya
CREATE TABLE IF NOT EXISTS public.peer_reviews (
    ticket_id UUID PRIMARY KEY REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    relawan_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT NULL CHECK (review IS NULL OR pg_catalog.char_length(review) <= 500),
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.peer_reviews IS 'Ulasan bintang dan teks dari pasien untuk relawan sebaya (maksimal 1 per tiket)';
COMMENT ON COLUMN public.peer_reviews.ticket_id IS 'ID tiket curhat sebaya (primary key, cascade delete saat tiket dihapus)';
COMMENT ON COLUMN public.peer_reviews.patient_id IS 'ID pengguna pasien yang memberikan ulasan';
COMMENT ON COLUMN public.peer_reviews.relawan_id IS 'ID pengguna relawan yang diulas';
COMMENT ON COLUMN public.peer_reviews.rating IS 'Nilai bintang ulasan (1 sampai 5)';
COMMENT ON COLUMN public.peer_reviews.review IS 'Teks masukan bebas (maksimal 500 karakter)';
COMMENT ON COLUMN public.peer_reviews.is_hidden IS 'Flag moderasi admin (true jika disembunyikan dari tampilan publik)';
COMMENT ON COLUMN public.peer_reviews.created_at IS 'Waktu ulasan dibuat';
COMMENT ON COLUMN public.peer_reviews.updated_at IS 'Waktu ulasan diperbarui';

-- Indeks performa relawan & pasien
CREATE INDEX IF NOT EXISTS idx_peer_reviews_relawan
    ON public.peer_reviews(relawan_id, created_at DESC)
    WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_peer_reviews_patient
    ON public.peer_reviews(patient_id);

-- Row Level Security (RLS)
ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_reviews_select_policy ON public.peer_reviews;
CREATE POLICY peer_reviews_select_policy ON public.peer_reviews
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id
        OR auth.uid() = relawan_id
        OR public.is_admin()
    );

-- Mutasi PostgREST dicabut penuh dari anon dan authenticated
REVOKE ALL ON public.peer_reviews FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.peer_reviews FROM anon, authenticated;
GRANT SELECT ON public.peer_reviews TO authenticated;
GRANT ALL ON public.peer_reviews TO service_role;

-- Realtime Publication (idempoten)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_reviews;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 3. RPC: public.peer_ticket_close
-- Menutup tiket aktif secara manual oleh peserta tiket (pasien/relawan) atau admin
CREATE OR REPLACE FUNCTION public.peer_ticket_close(
    p_ticket_id UUID,
    p_user_id UUID
)
RETURNS public.peer_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets%ROWTYPE;
    v_closed_by TEXT;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- 1. Validasi parameter
    IF p_ticket_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    -- 2. Ambil tiket dengan locking
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Validasi status
    IF v_ticket.status <> 'active'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Cek otorisasi pemanggil
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id AND role = 'admin'::public.user_role
    ) INTO v_is_admin;

    IF p_user_id = v_ticket.patient_id THEN
        v_closed_by := 'pasien';
    ELSIF p_user_id = v_ticket.claimed_by THEN
        v_closed_by := 'relawan';
    ELSIF v_is_admin THEN
        v_closed_by := 'system';
    ELSE
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    -- 5. Update status tiket
    UPDATE public.peer_tickets
    SET
        status = 'closed'::public.peer_ticket_status,
        closed_at = pg_catalog.now(),
        closed_by = v_closed_by,
        updated_at = pg_catalog.now()
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_close(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_close(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.peer_ticket_close(UUID, UUID) IS 'Menutup tiket aktif secara manual oleh pasien, relawan terkait, atau admin/system';

-- 4. RPC: public.peer_ticket_tick
-- Pembaruan worker cron untuk menangani claimed timeout, open archive, dan penutupan otomatis sesi active > 24 jam
CREATE OR REPLACE FUNCTION public.peer_ticket_tick()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_response_mins INTEGER;
    v_archive_hours INTEGER;
    v_timeout_count INTEGER := 0;
    v_archived_count INTEGER := 0;
    v_closed_count INTEGER := 0;
    r_ticket public.peer_tickets%ROWTYPE;
    v_claim_date DATE;
    v_new_abandoned UUID[];
BEGIN
    -- 1. Baca konfigurasi dari system_settings
    SELECT
        COALESCE(
            (value->>'claim_response_minutes')::INTEGER,
            (value->'relawan'->>'claim_response_minutes')::INTEGER,
            10
        ),
        COALESCE(
            (value->>'unclaimed_archive_hours')::INTEGER,
            (value->'relawan'->>'unclaimed_archive_hours')::INTEGER,
            24
        )
    INTO v_response_mins, v_archive_hours
    FROM public.system_settings
    WHERE key = 'relawan';

    v_response_mins := COALESCE(v_response_mins, 10);
    v_archive_hours := COALESCE(v_archive_hours, 24);

    -- 2. Tangani tiket claimed yang timeout (> claim_response_minutes tanpa first response)
    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'claimed'::public.peer_ticket_status
          AND claimed_at IS NOT NULL
          AND claimed_at + (v_response_mins * interval '1 minute') < pg_catalog.now()
        FOR UPDATE SKIP LOCKED
    LOOP
        IF r_ticket.claimed_by IS NOT NULL THEN
            v_claim_date := (r_ticket.claimed_at AT TIME ZONE 'Asia/Jakarta')::DATE;

            INSERT INTO public.relawan_daily_quota (
                relawan_id,
                quota_date,
                tickets_claimed,
                penalty_points
            )
            VALUES (
                r_ticket.claimed_by,
                v_claim_date,
                0,
                1
            )
            ON CONFLICT (relawan_id, quota_date)
            DO UPDATE SET
                penalty_points = public.relawan_daily_quota.penalty_points + 1;

            IF NOT (r_ticket.claimed_by = ANY(r_ticket.abandoned_by)) THEN
                v_new_abandoned := pg_catalog.array_append(r_ticket.abandoned_by, r_ticket.claimed_by);
            ELSE
                v_new_abandoned := r_ticket.abandoned_by;
            END IF;
        ELSE
            v_new_abandoned := r_ticket.abandoned_by;
        END IF;

        UPDATE public.peer_tickets
        SET
            status = 'open'::public.peer_ticket_status,
            claimed_by = NULL,
            claimed_at = NULL,
            abandoned_by = v_new_abandoned,
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_timeout_count := v_timeout_count + 1;
    END LOOP;

    -- 3. Arsipkan tiket open yang > 24 jam belum diklaim siapapun
    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'open'::public.peer_ticket_status
          AND created_at + (v_archive_hours * interval '1 hour') < pg_catalog.now()
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.peer_tickets
        SET
            status = 'archived'::public.peer_ticket_status,
            archived_at = pg_catalog.now(),
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_archived_count := v_archived_count + 1;
    END LOOP;

    -- 4. Tutup tiket active yang melebihi 24 jam sejak balasan pertama (first_response_at)
    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'active'::public.peer_ticket_status
          AND first_response_at IS NOT NULL
          AND first_response_at + interval '24 hours' < pg_catalog.now()
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.peer_tickets
        SET
            status = 'closed'::public.peer_ticket_status,
            closed_at = pg_catalog.now(),
            closed_by = 'system',
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_closed_count := v_closed_count + 1;
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'timeout_count', v_timeout_count,
        'archived_count', v_archived_count,
        'closed_count', v_closed_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_tick() TO service_role;

COMMENT ON FUNCTION public.peer_ticket_tick() IS 'Cron worker untuk penalti timeout claimed, pengarsipan open kedaluwarsa, dan penutupan otomatis sesi active > 24 jam';

-- 5. RPC: public.peer_review_create
-- Pasien memberikan ulasan bintang dan teks untuk tiket yang telah berstatus closed
CREATE OR REPLACE FUNCTION public.peer_review_create(
    p_ticket_id UUID,
    p_patient_id UUID,
    p_rating INT,
    p_review TEXT
)
RETURNS public.peer_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets%ROWTYPE;
    v_clean_review TEXT;
    v_window_days INTEGER := 7;
    v_review public.peer_reviews%ROWTYPE;
BEGIN
    -- 1. Validasi parameter
    IF p_ticket_id IS NULL OR p_patient_id IS NULL OR p_rating IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'INVALID_RATING' USING ERRCODE = '22023';
    END IF;

    v_clean_review := NULLIF(pg_catalog.btrim(p_review), '');
    IF v_clean_review IS NOT NULL AND pg_catalog.char_length(v_clean_review) > 500 THEN
        RAISE EXCEPTION 'REVIEW_TOO_LONG' USING ERRCODE = '22023';
    END IF;

    -- 2. Ambil data tiket
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Validasi hak akses peserta (hanya pasien pemilik tiket)
    IF v_ticket.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    -- 4. Validasi status tiket (harus closed)
    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    IF v_ticket.claimed_by IS NULL THEN
        RAISE EXCEPTION 'TICKET_NO_RELAWAN' USING ERRCODE = 'P0001';
    END IF;

    -- 5. Cek apakah tiket sudah pernah diulas
    IF EXISTS (SELECT 1 FROM public.peer_reviews WHERE ticket_id = p_ticket_id) THEN
        RAISE EXCEPTION 'ALREADY_REVIEWED' USING ERRCODE = '23505';
    END IF;

    -- 6. Validasi jendela waktu ulasan (rating.window_days sejak closed_at)
    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_ticket.closed_at, v_ticket.updated_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'RATING_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    -- 7. Simpan ulasan ke tabel peer_reviews
    INSERT INTO public.peer_reviews (
        ticket_id,
        patient_id,
        relawan_id,
        rating,
        review,
        is_hidden,
        created_at,
        updated_at
    )
    VALUES (
        p_ticket_id,
        p_patient_id,
        v_ticket.claimed_by,
        p_rating::SMALLINT,
        v_clean_review,
        false,
        pg_catalog.now(),
        pg_catalog.now()
    )
    RETURNING * INTO v_review;

    RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_review_create(UUID, UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_review_create(UUID, UUID, INT, TEXT) TO service_role;

COMMENT ON FUNCTION public.peer_review_create(UUID, UUID, INT, TEXT) IS 'Mencatat ulasan bintang dan teks dari pasien untuk sesi curhat sebaya yang telah ditutup';

-- 6. RPC: public.peer_ticket_tip
-- Memberikan tip koin dari pasien ke relawan sebaya untuk tiket yang telah ditutup
CREATE OR REPLACE FUNCTION public.peer_ticket_tip(
    p_tip_id UUID,
    p_ticket_id UUID,
    p_patient_id UUID,
    p_coins BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets%ROWTYPE;
    v_window_days INTEGER := 7;
BEGIN
    -- 1. Validasi parameter
    IF p_tip_id IS NULL OR p_ticket_id IS NULL OR p_patient_id IS NULL OR p_coins IS NULL OR p_coins <= 0 THEN
        RAISE EXCEPTION 'INVALID_COINS' USING ERRCODE = '22023';
    END IF;

    -- 2. Ambil data tiket
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Validasi kepemilikan pasien
    IF v_ticket.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    -- 4. Validasi status tiket
    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    IF v_ticket.claimed_by IS NULL THEN
        RAISE EXCEPTION 'TICKET_NO_RELAWAN' USING ERRCODE = 'P0001';
    END IF;

    -- 5. Validasi jendela waktu tip (rating.window_days sejak closed_at)
    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_ticket.closed_at, v_ticket.updated_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'TIP_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    -- 6. Panggil tip_create dari subsistem wallet (source_type = 'ticket')
    PERFORM public.tip_create(
        p_tip_id,
        p_patient_id,
        v_ticket.claimed_by,
        p_coins,
        'ticket',
        p_ticket_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_tip(UUID, UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_tip(UUID, UUID, UUID, BIGINT) TO service_role;

COMMENT ON FUNCTION public.peer_ticket_tip(UUID, UUID, UUID, BIGINT) IS 'Memberikan apresiasi tip koin idempoten dari pasien ke relawan sebaya untuk tiket yang telah ditutup';

-- 7. RPC: public.peer_rating_summary
-- Agregat rating relawan sebaya: rata-rata hanya jika count >= min_count_to_show, exclude is_hidden
CREATE OR REPLACE FUNCTION public.peer_rating_summary(p_relawan_id UUID)
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
    IF p_relawan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

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
    FROM public.peer_reviews AS r
    WHERE r.relawan_id = p_relawan_id
      AND r.is_hidden = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_rating_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peer_rating_summary(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.peer_rating_summary(UUID) IS 'Menghasilkan rata-rata rating (jika ulasan >= min_count_to_show) dan total ulasan relawan sebaya';
