-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000024 (PEER CLOSURE, REVIEWS & TIPS)
-- Path: supabase/tests/peer_closure_reviews_dryrun.sql
-- Scope:
-- 1. Setup fixture: auth.users, public.users, profiles, wallets, system_settings
-- 2. DDL Salinan persis dari 20261022000024_peer_closure_reviews.sql
-- 3. Uji 1: Verifikasi kolom closed_by dan check constraint pada peer_tickets
-- 4. Uji 2: peer_ticket_close oleh pasien (status closed, closed_by = 'pasien')
-- 5. Uji 3: peer_ticket_close oleh relawan (status closed, closed_by = 'relawan')
-- 6. Uji 4: peer_ticket_close oleh admin (status closed, closed_by = 'system')
-- 7. Uji 5: peer_ticket_close oleh non-partisipan ditolak (FORBIDDEN)
-- 8. Uji 6: peer_ticket_close tiket non-aktif ditolak (TICKET_NOT_ACTIVE)
-- 9. Uji 7: peer_ticket_tick menutup tiket active > 24 jam (closed_by = 'system')
-- 10. Uji 8: peer_review_create (berhasil, validasi rating 1-5, panjang maks 500, window 7 hari, duplikasi ditolak)
-- 11. Uji 9: peer_ticket_tip (potong koin idempoten, tips_source_once, batas window, validasi peran)
-- 12. Uji 10: peer_rating_summary (threshold min_count_to_show, pembulatan 1 desimal, exclude is_hidden)
-- 13. Uji 11: RLS peer_reviews (akses peserta tiket & admin, isolasi pengguna lain)
-- 14. Uji 12: Pencabutan hak mutasi langsung (INSERT/UPDATE/DELETE/TRUNCATE) bagi role authenticated
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP FIXTURE USERS: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('f7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p1_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p5_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r1_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r2_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f7000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other_closure@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('f7000000-0000-0000-0000-000000000001', 'p1_closure@temanbicara.test', '081266660001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000002', 'p2_closure@temanbicara.test', '081266660002', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000003', 'p3_closure@temanbicara.test', '081266660003', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000004', 'p4_closure@temanbicara.test', '081266660004', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000005', 'p5_closure@temanbicara.test', '081266660005', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000010', 'r1_closure@temanbicara.test', '081266660010', 'relawan'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000020', 'r2_closure@temanbicara.test', '081266660020', 'relawan'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000030', 'adm_closure@temanbicara.test', '081266660030', 'admin'::public.user_role, 'active'::public.account_status),
    ('f7000000-0000-0000-0000-000000000040', 'other_closure@temanbicara.test', '081266660040', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Profil Pasien
INSERT INTO public.pasien_profiles (
    user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
)
VALUES
    ('f7000000-0000-0000-0000-000000000001', 'Pasien Uji Satu', 'Satu', 'Ibu Satu', '081200000001', false),
    ('f7000000-0000-0000-0000-000000000002', 'Pasien Uji Dua', 'Dua', 'Ibu Dua', '081200000002', false),
    ('f7000000-0000-0000-0000-000000000003', 'Pasien Uji Tiga', 'Tiga', 'Ibu Tiga', '081200000003', false),
    ('f7000000-0000-0000-0000-000000000004', 'Pasien Uji Empat', 'Empat', 'Ibu Empat', '081200000004', false),
    ('f7000000-0000-0000-0000-000000000005', 'Pasien Uji Lima', 'Lima', 'Ibu Lima', '081200000005', false)
ON CONFLICT (user_id) DO NOTHING;

-- Profil Relawan
INSERT INTO public.relawan_profiles (user_id, nama_lengkap, alias_name, latar_belakang, alasan_bergabung, total_sesi, is_available, topik_keahlian)
VALUES
    ('f7000000-0000-0000-0000-000000000010', 'Relawan Satu Uji', 'Kak Bintang', 'Psikologi', 'Mendengarkan', 0, true, ARRAY['Kecemasan', 'Stres']),
    ('f7000000-0000-0000-0000-000000000020', 'Relawan Dua Uji', 'Kak Awan', 'Konseling', 'Membantu', 0, true, ARRAY['Depresi', 'Karier'])
ON CONFLICT (user_id) DO NOTHING;

-- Profil Admin
INSERT INTO public.admin_profiles (user_id, nama_lengkap, level)
VALUES
    ('f7000000-0000-0000-0000-000000000030', 'Admin Penguji Closure', 'superadmin')
ON CONFLICT (user_id) DO NOTHING;

-- Konfigurasi Sistem
INSERT INTO public.system_settings (key, value)
VALUES
    ('rating', '{"window_days": 7, "min_count_to_show": 3}'::jsonb),
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24, "max_carry_penalty": 1}'::jsonb),
    ('tip', '{"min_coins": 1, "max_coins": 10, "daily_cap_coins_per_patient": 50}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Wallets untuk pengujian tip koin
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('f7000000-0000-0000-0000-000000000001', 50, 0, 0),
    ('f7000000-0000-0000-0000-000000000002', 50, 0, 0),
    ('f7000000-0000-0000-0000-000000000010', 0, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET
    coin_balance = EXCLUDED.coin_balance,
    pending_rupiah = 0,
    available_rupiah = 0;

-- Helper RLS is_admin() jika belum tersedia
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

-- Setup tabel peer_tickets jika belum ada di database lokal
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'peer_ticket_status') THEN
        CREATE TYPE public.peer_ticket_status AS ENUM ('open', 'claimed', 'active', 'closed', 'archived');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.peer_tickets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    patient_alias TEXT NOT NULL,
    topic TEXT NOT NULL,
    emotion TEXT NOT NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    status public.peer_ticket_status NOT NULL DEFAULT 'open',
    claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ NULL,
    first_response_at TIMESTAMPTZ NULL,
    closed_at TIMESTAMPTZ NULL,
    archived_at TIMESTAMPTZ NULL,
    abandoned_by UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ========================================================
-- 2. DDL MIGRATION: 20261022000024_peer_closure_reviews.sql
-- ========================================================

-- Pembaruan kolom closed_by
ALTER TABLE public.peer_tickets
    ADD COLUMN IF NOT EXISTS closed_by TEXT NULL
    CHECK (closed_by IN ('pasien', 'relawan', 'system'));

-- Pembuatan tabel peer_reviews
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

CREATE INDEX IF NOT EXISTS idx_peer_reviews_relawan
    ON public.peer_reviews(relawan_id, created_at DESC)
    WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_peer_reviews_patient
    ON public.peer_reviews(patient_id);

ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_reviews_select_policy ON public.peer_reviews;
CREATE POLICY peer_reviews_select_policy ON public.peer_reviews
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id
        OR auth.uid() = relawan_id
        OR public.is_admin()
    );

REVOKE ALL ON public.peer_reviews FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.peer_reviews FROM anon, authenticated;
GRANT SELECT ON public.peer_reviews TO authenticated;
GRANT ALL ON public.peer_reviews TO service_role;

-- RPC: peer_ticket_close
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
    IF p_ticket_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_ticket.status <> 'active'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

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

-- RPC: peer_ticket_tick
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

-- RPC: peer_review_create
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

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_ticket.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    IF v_ticket.claimed_by IS NULL THEN
        RAISE EXCEPTION 'TICKET_NO_RELAWAN' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (SELECT 1 FROM public.peer_reviews WHERE ticket_id = p_ticket_id) THEN
        RAISE EXCEPTION 'ALREADY_REVIEWED' USING ERRCODE = '23505';
    END IF;

    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_ticket.closed_at, v_ticket.updated_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'RATING_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

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

-- RPC: peer_ticket_tip
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
    IF p_tip_id IS NULL OR p_ticket_id IS NULL OR p_patient_id IS NULL OR p_coins IS NULL OR p_coins <= 0 THEN
        RAISE EXCEPTION 'INVALID_COINS' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TICKET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_ticket.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    IF v_ticket.claimed_by IS NULL THEN
        RAISE EXCEPTION 'TICKET_NO_RELAWAN' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE((value->>'window_days')::INTEGER, 7)
    INTO v_window_days
    FROM public.system_settings
    WHERE key = 'rating';
    v_window_days := COALESCE(v_window_days, 7);

    IF pg_catalog.now() > COALESCE(v_ticket.closed_at, v_ticket.updated_at) + (v_window_days * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'TIP_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

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

-- RPC: peer_rating_summary
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

-- ========================================================
-- 3. FIXTURE TIKET CURHAT SEBAYA
-- ========================================================

-- Tiket 1: Untuk pengujian penutupan oleh pasien, review, dan tip
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f7a00000-0000-0000-0000-000000000001',
    'f7000000-0000-0000-0000-000000000001',
    'Bunga Melati', 'Kecemasan', 'Gelisah', 'Curhat nomor satu untuk penutupan oleh pasien...', true,
    'active'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '2 hours',
    pg_catalog.now() - interval '1 hour'
);

-- Tiket 2: Untuk pengujian penutupan oleh relawan dan ulasan kedua
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f7a00000-0000-0000-0000-000000000002',
    'f7000000-0000-0000-0000-000000000002',
    'Bunga Mawar', 'Stres', 'Lelah', 'Curhat nomor dua untuk penutupan oleh relawan...', true,
    'active'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '2 hours',
    pg_catalog.now() - interval '1 hour'
);

-- Tiket 3: Untuk pengujian penutupan oleh admin dan ulasan ketiga
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f7a00000-0000-0000-0000-000000000003',
    'f7000000-0000-0000-0000-000000000003',
    'Bunga Tulip', 'Depresi', 'Sedih', 'Curhat nomor tiga untuk penutupan oleh admin...', true,
    'active'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '2 hours',
    pg_catalog.now() - interval '1 hour'
);

-- Tiket 4: Tiket aktif untuk pengujian penolakan aksi ilegal saat aktif
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f7a00000-0000-0000-0000-000000000004',
    'f7000000-0000-0000-0000-000000000004',
    'Bunga Anggrek', 'Karier', 'Bingung', 'Curhat nomor empat tetap active untuk verifikasi penolakan...', true,
    'active'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '1 hour',
    pg_catalog.now() - interval '30 minutes'
);

-- Tiket 5: Tiket aktif > 24 jam untuk pengujian cron tick auto-close
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f7a00000-0000-0000-0000-000000000005',
    'f7000000-0000-0000-0000-000000000005',
    'Bunga Matahari', 'Kesepian', 'Hampa', 'Curhat nomor lima aktif lebih dari 24 jam...', true,
    'active'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '26 hours',
    pg_catalog.now() - interval '25 hours'
);

-- Tiket 6: Tiket closed yang sudah lewat window 7 hari (untuk uji RATING_WINDOW_EXPIRED)
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at, closed_at, closed_by
)
VALUES (
    'f7a00000-0000-0000-0000-000000000006',
    'f7000000-0000-0000-0000-000000000001',
    'Bunga Lily', 'Keluarga', 'Kecewa', 'Curhat nomor enam sudah kedaluwarsa masa ratingnya...', true,
    'closed'::public.peer_ticket_status,
    'f7000000-0000-0000-0000-000000000010',
    pg_catalog.now() - interval '10 days',
    pg_catalog.now() - interval '10 days',
    pg_catalog.now() - interval '9 days',
    'pasien'
);

-- ========================================================
-- 4. SUITE PENGUJIAN LOGIKA & ASSERTIONS
-- ========================================================

DO $$
DECLARE
    v_ticket public.peer_tickets%ROWTYPE;
    v_review public.peer_reviews%ROWTYPE;
    v_summary RECORD;
    v_tick_res JSONB;
    v_caught BOOLEAN;
    v_err_code TEXT;
    v_err_msg TEXT;
    v_balance BIGINT;
    v_tip_count BIGINT;
BEGIN
    -- ----------------------------------------------------
    -- UJI 1: Verifikasi Kolom closed_by dan Check Constraint
    -- ----------------------------------------------------
    -- Nilai valid ('pasien', 'relawan', 'system') dapat disimpan
    UPDATE public.peer_tickets
    SET closed_by = 'pasien'
    WHERE id = 'f7a00000-0000-0000-0000-000000000001';

    -- Nilai tidak valid ('alien') wajib melempar check constraint violation (23514)
    v_caught := false;
    BEGIN
        UPDATE public.peer_tickets
        SET closed_by = 'alien'
        WHERE id = 'f7a00000-0000-0000-0000-000000000001';
    EXCEPTION WHEN check_violation THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Check constraint closed_by harus menolak nilai di luar (pasien, relawan, system)';
    END IF;

    -- Kembalikan kolom closed_by ke NULL untuk Tiket 1 sebelum diuji via RPC
    UPDATE public.peer_tickets
    SET closed_by = NULL
    WHERE id = 'f7a00000-0000-0000-0000-000000000001';

    -- ----------------------------------------------------
    -- UJI 2: peer_ticket_close oleh Pasien
    -- ----------------------------------------------------
    v_ticket := public.peer_ticket_close(
        'f7a00000-0000-0000-0000-000000000001',
        'f7000000-0000-0000-0000-000000000001'
    );

    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'UJI 2.1 GAGAL: Status tiket harus berubah ke closed, didapat: %', v_ticket.status;
    END IF;

    IF v_ticket.closed_by <> 'pasien' THEN
        RAISE EXCEPTION 'UJI 2.2 GAGAL: closed_by harus pasien saat ditutup pasien, didapat: %', v_ticket.closed_by;
    END IF;

    IF v_ticket.closed_at IS NULL THEN
        RAISE EXCEPTION 'UJI 2.3 GAGAL: closed_at harus terisi waktu penutupan';
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: peer_ticket_close oleh Relawan
    -- ----------------------------------------------------
    v_ticket := public.peer_ticket_close(
        'f7a00000-0000-0000-0000-000000000002',
        'f7000000-0000-0000-0000-000000000010'
    );

    IF v_ticket.status <> 'closed'::public.peer_ticket_status OR v_ticket.closed_by <> 'relawan' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: closed_by harus relawan saat ditutup relawan, didapat: %', v_ticket.closed_by;
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: peer_ticket_close oleh Admin
    -- ----------------------------------------------------
    v_ticket := public.peer_ticket_close(
        'f7a00000-0000-0000-0000-000000000003',
        'f7000000-0000-0000-0000-000000000030'
    );

    IF v_ticket.status <> 'closed'::public.peer_ticket_status OR v_ticket.closed_by <> 'system' THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: closed_by harus system saat ditutup admin, didapat: %', v_ticket.closed_by;
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: peer_ticket_close oleh Pengguna Lain (Non-Partisipan)
    -- ----------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_close(
            'f7a00000-0000-0000-0000-000000000004',
            'f7000000-0000-0000-0000-000000000040'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'FORBIDDEN' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Penutupan oleh pengguna lain harus melempar FORBIDDEN, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 6: peer_ticket_close Tiket yang Sudah Closed
    -- ----------------------------------------------------
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_close(
            'f7a00000-0000-0000-0000-000000000001',
            'f7000000-0000-0000-0000-000000000001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'TICKET_NOT_ACTIVE' THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Penutupan tiket yang sudah closed harus melempar TICKET_NOT_ACTIVE, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 7: peer_ticket_tick Auto-Close Tiket Active > 24 Jam
    -- ----------------------------------------------------
    v_tick_res := public.peer_ticket_tick();

    IF (v_tick_res->>'closed_count')::INTEGER < 1 THEN
        RAISE EXCEPTION 'UJI 7.1 GAGAL: peer_ticket_tick harus menutup minimal 1 tiket active > 24 jam, didapat: %', v_tick_res;
    END IF;

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = 'f7a00000-0000-0000-0000-000000000005';

    IF v_ticket.status <> 'closed'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'UJI 7.2 GAGAL: Tiket 5 harus otomatis berstatus closed oleh tick';
    END IF;

    IF v_ticket.closed_by <> 'system' THEN
        RAISE EXCEPTION 'UJI 7.3 GAGAL: closed_by tiket auto-close harus system, didapat: %', v_ticket.closed_by;
    END IF;

    IF v_ticket.closed_at IS NULL THEN
        RAISE EXCEPTION 'UJI 7.4 GAGAL: closed_at tiket auto-close harus terisi';
    END IF;

    -- ----------------------------------------------------
    -- UJI 8: peer_review_create (Pembuatan & Validasi Ulasan)
    -- ----------------------------------------------------
    -- 8.1. Pasien 1 memberikan ulasan valid untuk Tiket 1 (rating 5)
    v_review := public.peer_review_create(
        'f7a00000-0000-0000-0000-000000000001',
        'f7000000-0000-0000-0000-000000000001',
        5,
        'Relawan sangat sabar dan mendengarkan dengan penuh empati.'
    );

    IF v_review.rating <> 5 OR v_review.relawan_id <> 'f7000000-0000-0000-0000-000000000010' THEN
        RAISE EXCEPTION 'UJI 8.1 GAGAL: Data ulasan tidak tersimpan tepat, rating: %, relawan: %',
            v_review.rating, v_review.relawan_id;
    END IF;

    IF v_review.is_hidden <> false THEN
        RAISE EXCEPTION 'UJI 8.1 GAGAL: Default is_hidden harus false';
    END IF;

    -- 8.2. Ulasan duplikat pada tiket yang sama harus ditolak (ALREADY_REVIEWED)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000001',
            'f7000000-0000-0000-0000-000000000001',
            4,
            'Mencoba ulasan ganda...'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'ALREADY_REVIEWED' THEN
        RAISE EXCEPTION 'UJI 8.2 GAGAL: Ulasan kedua harus ditolak ALREADY_REVIEWED, didapat: %', v_err_msg;
    END IF;

    -- 8.3. Rating < 1 ditolak (INVALID_RATING)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000002',
            0,
            'Rating nol'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'INVALID_RATING' THEN
        RAISE EXCEPTION 'UJI 8.3 GAGAL: Rating 0 harus ditolak INVALID_RATING, didapat: %', v_err_msg;
    END IF;

    -- 8.4. Rating > 5 ditolak (INVALID_RATING)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000002',
            6,
            'Rating enam'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'INVALID_RATING' THEN
        RAISE EXCEPTION 'UJI 8.4 GAGAL: Rating 6 harus ditolak INVALID_RATING, didapat: %', v_err_msg;
    END IF;

    -- 8.5. Teks ulasan > 500 karakter ditolak (REVIEW_TOO_LONG)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000002',
            5,
            pg_catalog.repeat('A', 501)
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'REVIEW_TOO_LONG' THEN
        RAISE EXCEPTION 'UJI 8.5 GAGAL: Review > 500 karakter harus ditolak REVIEW_TOO_LONG, didapat: %', v_err_msg;
    END IF;

    -- 8.6. Ulasan oleh non-pasien tiket ditolak (FORBIDDEN)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000040',
            5,
            'Ulasan oleh orang asing'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'FORBIDDEN' THEN
        RAISE EXCEPTION 'UJI 8.6 GAGAL: Ulasan oleh bukan pemilik tiket harus ditolak FORBIDDEN, didapat: %', v_err_msg;
    END IF;

    -- 8.7. Ulasan pada tiket belum closed ditolak (TICKET_NOT_CLOSED)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000004', -- status active
            'f7000000-0000-0000-0000-000000000004',
            5,
            'Ulasan tiket aktif'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'TICKET_NOT_CLOSED' THEN
        RAISE EXCEPTION 'UJI 8.7 GAGAL: Ulasan pada tiket aktif harus ditolak TICKET_NOT_CLOSED, didapat: %', v_err_msg;
    END IF;

    -- 8.8. Ulasan setelah jendela 7 hari kedaluwarsa ditolak (RATING_WINDOW_EXPIRED)
    v_caught := false;
    BEGIN
        PERFORM public.peer_review_create(
            'f7a00000-0000-0000-0000-000000000006', -- closed_at 9 hari lalu
            'f7000000-0000-0000-0000-000000000001',
            5,
            'Ulasan kedaluwarsa'
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'RATING_WINDOW_EXPIRED' THEN
        RAISE EXCEPTION 'UJI 8.8 GAGAL: Ulasan lewat 7 hari harus ditolak RATING_WINDOW_EXPIRED, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 9: peer_ticket_tip (Apresiasi Tip Koin Relawan)
    -- ----------------------------------------------------
    -- 9.1. Pasien 1 memberikan tip 5 koin untuk Tiket 1
    PERFORM public.peer_ticket_tip(
        'f7b00000-0000-0000-0000-000000000001',
        'f7a00000-0000-0000-0000-000000000001',
        'f7000000-0000-0000-0000-000000000001',
        5
    );

    -- Cek saldo dompet pasien berkurang dari 50 menjadi 45
    SELECT coin_balance INTO v_balance
    FROM public.wallets
    WHERE user_id = 'f7000000-0000-0000-0000-000000000001';

    IF v_balance <> 45 THEN
        RAISE EXCEPTION 'UJI 9.1 GAGAL: Saldo koin pasien harus berkurang 5 menjadi 45, didapat: %', v_balance;
    END IF;

    -- Cek pencatatan tip di tabel tips
    SELECT COUNT(*) INTO v_tip_count
    FROM public.tips
    WHERE source_type = 'ticket'
      AND source_id = 'f7a00000-0000-0000-0000-000000000001'
      AND coins = 5;

    IF v_tip_count <> 1 THEN
        RAISE EXCEPTION 'UJI 9.1 GAGAL: Catatan tip ticket tidak ditemukan di tabel tips';
    END IF;

    -- 9.2. Tip kedua pada tiket yang sama harus ditolak oleh constraint tips_source_once
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_tip(
            'f7b00000-0000-0000-0000-000000000002',
            'f7a00000-0000-0000-0000-000000000001',
            'f7000000-0000-0000-0000-000000000001',
            3
        );
    EXCEPTION WHEN unique_violation THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'UJI 9.2 GAGAL: Tip kedua pada tiket yang sama harus ditolak tips_source_once unique constraint';
    END IF;

    -- 9.3. Tip pada tiket belum closed ditolak (TICKET_NOT_CLOSED)
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_tip(
            'f7b00000-0000-0000-0000-000000000003',
            'f7a00000-0000-0000-0000-000000000004', -- status active
            'f7000000-0000-0000-0000-000000000004',
            5
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'TICKET_NOT_CLOSED' THEN
        RAISE EXCEPTION 'UJI 9.3 GAGAL: Tip pada tiket aktif harus ditolak TICKET_NOT_CLOSED, didapat: %', v_err_msg;
    END IF;

    -- 9.4. Tip oleh non-pasien tiket ditolak (FORBIDDEN)
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_tip(
            'f7b00000-0000-0000-0000-000000000004',
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000040',
            5
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'FORBIDDEN' THEN
        RAISE EXCEPTION 'UJI 9.4 GAGAL: Tip oleh bukan pemilik tiket harus ditolak FORBIDDEN, didapat: %', v_err_msg;
    END IF;

    -- 9.5. Tip setelah jendela 7 hari kedaluwarsa ditolak (TIP_WINDOW_EXPIRED)
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_tip(
            'f7b00000-0000-0000-0000-000000000005',
            'f7a00000-0000-0000-0000-000000000006', -- closed 9 hari lalu
            'f7000000-0000-0000-0000-000000000001',
            5
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'TIP_WINDOW_EXPIRED' THEN
        RAISE EXCEPTION 'UJI 9.5 GAGAL: Tip lewat 7 hari harus ditolak TIP_WINDOW_EXPIRED, didapat: %', v_err_msg;
    END IF;

    -- 9.6. Koin <= 0 ditolak (INVALID_COINS)
    v_caught := false;
    BEGIN
        PERFORM public.peer_ticket_tip(
            'f7b00000-0000-0000-0000-000000000006',
            'f7a00000-0000-0000-0000-000000000002',
            'f7000000-0000-0000-0000-000000000002',
            0
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
        v_err_msg := SQLERRM;
    END;

    IF NOT v_caught OR v_err_msg <> 'INVALID_COINS' THEN
        RAISE EXCEPTION 'UJI 9.6 GAGAL: Koin 0 harus ditolak INVALID_COINS, didapat: %', v_err_msg;
    END IF;

    -- ----------------------------------------------------
    -- UJI 10: peer_rating_summary (Agregat & Threshold Rating)
    -- ----------------------------------------------------
    -- Saat ini Relawan 1 memiliki 1 ulasan (rating 5 dari Tiket 1)
    SELECT * INTO v_summary
    FROM public.peer_rating_summary('f7000000-0000-0000-0000-000000000010');

    IF v_summary.rating_count <> 1 OR v_summary.rating_avg IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 10.1 GAGAL: 1 ulasan harus menghasilkan rating_avg NULL dan count 1, didapat: count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- Tambahkan ulasan kedua pada Tiket 2 (rating 4 dari Pasien 2)
    PERFORM public.peer_review_create(
        'f7a00000-0000-0000-0000-000000000002',
        'f7000000-0000-0000-0000-000000000002',
        4,
        'Mendengarkan dengan tulus.'
    );

    SELECT * INTO v_summary
    FROM public.peer_rating_summary('f7000000-0000-0000-0000-000000000010');

    IF v_summary.rating_count <> 2 OR v_summary.rating_avg IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 10.2 GAGAL: 2 ulasan harus menghasilkan rating_avg NULL dan count 2, didapat: count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- Tambahkan ulasan ketiga pada Tiket 3 (rating 3 dari Pasien 3)
    PERFORM public.peer_review_create(
        'f7a00000-0000-0000-0000-000000000003',
        'f7000000-0000-0000-0000-000000000003',
        3,
        'Cukup baik responnya.'
    );

    -- 3 ulasan (5, 4, 3) -> avg = 12 / 3 = 4.0
    SELECT * INTO v_summary
    FROM public.peer_rating_summary('f7000000-0000-0000-0000-000000000010');

    IF v_summary.rating_count <> 3 OR v_summary.rating_avg <> 4.0 THEN
        RAISE EXCEPTION 'UJI 10.3 GAGAL: 3 ulasan harus menghasilkan rating_avg 4.0 dan count 3, didapat: count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- Uji moderasi admin: sembunyikan 1 ulasan (is_hidden = true)
    UPDATE public.peer_reviews
    SET is_hidden = true
    WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';

    SELECT * INTO v_summary
    FROM public.peer_rating_summary('f7000000-0000-0000-0000-000000000010');

    -- Ulasan aktif tersisa 2 -> rating_avg kembali NULL
    IF v_summary.rating_count <> 2 OR v_summary.rating_avg IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 10.4 GAGAL: Ulasan tersembunyi harus dikecualikan dari summary, didapat: count=%, avg=%',
            v_summary.rating_count, v_summary.rating_avg;
    END IF;

    -- Kembalikan is_hidden = false
    UPDATE public.peer_reviews
    SET is_hidden = false
    WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';

    -- ----------------------------------------------------
    -- UJI 11: Row Level Security (RLS) pada peer_reviews
    -- ----------------------------------------------------
    -- Pasien 1 membaca ulasannya sendiri
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-000000000001"}', true);

    SELECT COUNT(*) INTO v_tip_count
    FROM public.peer_reviews
    WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';

    IF v_tip_count <> 1 THEN
        RAISE EXCEPTION 'UJI 11.1 GAGAL: Pasien 1 harus dapat membaca ulasan miliknya sendiri via RLS';
    END IF;

    -- Relawan 1 membaca ulasan yang diberikan kepadanya
    PERFORM set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-000000000010"}', true);

    SELECT COUNT(*) INTO v_tip_count
    FROM public.peer_reviews
    WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';

    IF v_tip_count <> 1 THEN
        RAISE EXCEPTION 'UJI 11.2 GAGAL: Relawan 1 harus dapat membaca ulasan untuknya via RLS';
    END IF;

    -- Pasien lain (Other User) membaca ulasan Tiket 1 -> harus 0 baris (terisolasi)
    PERFORM set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-000000000040"}', true);

    SELECT COUNT(*) INTO v_tip_count
    FROM public.peer_reviews
    WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';

    IF v_tip_count <> 0 THEN
        RAISE EXCEPTION 'UJI 11.3 GAGAL: Pengguna lain tidak boleh melihat ulasan orang lain, didapat: %', v_tip_count;
    END IF;

    -- Admin membaca seluruh ulasan
    PERFORM set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-000000000030"}', true);

    SELECT COUNT(*) INTO v_tip_count
    FROM public.peer_reviews;

    IF v_tip_count <> 3 THEN
        RAISE EXCEPTION 'UJI 11.4 GAGAL: Admin harus dapat melihat seluruh 3 ulasan, didapat: %', v_tip_count;
    END IF;

    -- Kembalikan context role
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    RAISE NOTICE 'PEER CLOSURE & REVIEWS LOGIC TESTS PASSED: Uji 1 sampai Uji 11 berhasil.';
END;
$$;

-- ========================================================
-- 5. UJI 12: PENCABUTAN HAK MUTASI POSTGREST (ROLE AUTHENTICATED)
-- ========================================================

-- Simulasi koneksi client authenticated
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

-- 12.1. Penolakan direct INSERT ke peer_reviews
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.peer_reviews (
            ticket_id, patient_id, relawan_id, rating, review
        )
        VALUES (
            'f7a00000-0000-0000-0000-000000000004',
            'f7000000-0000-0000-0000-000000000001',
            'f7000000-0000-0000-0000-000000000010',
            5,
            'Upaya bypass insert langsung'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 12.1 GAGAL: Error tak terduga (%): %', SQLSTATE, SQLERRM;
            END IF;
    END;

    IF NOT v_threw THEN
        RAISE EXCEPTION 'UJI 12.1 GAGAL: Role authenticated wajib DITOLAK saat direct INSERT ke peer_reviews';
    END IF;
END $$;

-- 12.2. Penolakan direct UPDATE ke peer_reviews
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.peer_reviews
        SET rating = 1
        WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 12.2 GAGAL: Error tak terduga (%): %', SQLSTATE, SQLERRM;
            END IF;
    END;

    IF NOT v_threw THEN
        RAISE EXCEPTION 'UJI 12.2 GAGAL: Role authenticated wajib DITOLAK saat direct UPDATE ke peer_reviews';
    END IF;
END $$;

-- 12.3. Penolakan direct DELETE ke peer_reviews
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        DELETE FROM public.peer_reviews
        WHERE ticket_id = 'f7a00000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 12.3 GAGAL: Error tak terduga (%): %', SQLSTATE, SQLERRM;
            END IF;
    END;

    IF NOT v_threw THEN
        RAISE EXCEPTION 'UJI 12.3 GAGAL: Role authenticated wajib DITOLAK saat direct DELETE ke peer_reviews';
    END IF;
END $$;

-- 12.4. Penolakan direct TRUNCATE ke peer_reviews
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        TRUNCATE TABLE public.peer_reviews;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 12.4 GAGAL: Error tak terduga (%): %', SQLSTATE, SQLERRM;
            END IF;
    END;

    IF NOT v_threw THEN
        RAISE EXCEPTION 'UJI 12.4 GAGAL: Role authenticated wajib DITOLAK saat direct TRUNCATE ke peer_reviews';
    END IF;
END $$;

RESET ROLE;

-- ========================================================
-- KESIMPULAN SUITE PENGUJIAN
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'SELURUH UJI DRY-RUN MIGRASI 000024 LULUS SEMPURNA.';
END $$;

ROLLBACK;
