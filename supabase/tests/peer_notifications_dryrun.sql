-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000027 (PEER NOTIFICATIONS)
-- Path: supabase/tests/peer_notifications_dryrun.sql
-- Scope:
-- 1. Setup fixture: auth.users, public.users, profiles, system_settings, wallets
-- 2. DDL Salinan persis dari 20261031000027_peer_notifications.sql
-- 3. Uji 1: Pool Antrean Tiket Baru (open baru -> relawan siaga berkuota, non-siaga/kuota habis lewati, debounce 15 menit)
-- 4. Uji 2: Tiket Diklaim (claimed -> notifikasi pasien ke /patient/peer-room/[id])
-- 5. Uji 3: Sesi Dimulai via First Response (active -> notifikasi pasien ke /patient/peer-room/[id])
-- 6. Uji 4: Peringatan Sisa Waktu Menyapa (peer_ticket_tick menit ke-7 s.d. 10 -> relawan, greeting_reminded_at terisi, idempoten)
-- 7. Uji 5: Timeout Sapaan 10 Menit (peer_ticket_tick -> tiket reopen, greeting_reminded_at reset NULL, notif pasien & relawan)
-- 8. Uji 6: Sesi Ditutup (closed_by = pasien -> notifikasi pasien & relawan)
-- 9. Uji 7: Pengarsipan Tiket Usang (open > 24 jam -> archived, notifikasi pasien)
-- 10. Uji 8: Ulasan Bintang Baru (peer_reviews -> relawan ke /listener/beranda)
-- 11. Uji 9: Tip Koin Apresiasi Tiket (tips source_type ticket -> relawan ke /listener/earnings)
-- 12. Uji 10: Pesan Baru di Ruang Dengar (peer_messages -> lawan bicara, rate limit 5 menit, anonimitas terjaga)
-- 13. Uji 11: Verifikasi Keamanan Fungsi (SECURITY DEFINER, search_path = '', REVOKE PUBLIC)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP FIXTURE: USERS, PROFILES, SETTINGS & TABLES
-- ========================================================

-- Setup auth.users
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('f8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p1_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p2_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p3_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p4_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p5_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p6_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r1_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r2_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r3_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('f8000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm_pnotif@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Setup public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('f8000000-0000-0000-0000-000000000001', 'p1_pnotif@temanbicara.test', '081288880001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000002', 'p2_pnotif@temanbicara.test', '081288880002', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000003', 'p3_pnotif@temanbicara.test', '081288880003', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000004', 'p4_pnotif@temanbicara.test', '081288880004', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000005', 'p5_pnotif@temanbicara.test', '081288880005', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000006', 'p6_pnotif@temanbicara.test', '081288880006', 'pasien'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000010', 'r1_pnotif@temanbicara.test', '081288880010', 'relawan'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000020', 'r2_pnotif@temanbicara.test', '081288880020', 'relawan'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000030', 'r3_pnotif@temanbicara.test', '081288880030', 'relawan'::public.user_role, 'active'::public.account_status),
    ('f8000000-0000-0000-0000-000000000040', 'adm_pnotif@temanbicara.test', '081288880040', 'admin'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Setup profil pasien
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('f8000000-0000-0000-0000-000000000001', 'Pasien Satu Asli', 'Satu', 'Ibu Satu', '081100000001', false),
    ('f8000000-0000-0000-0000-000000000002', 'Pasien Dua Asli', 'Dua', 'Ibu Dua', '081100000002', false),
    ('f8000000-0000-0000-0000-000000000003', 'Pasien Tiga Asli', 'Tiga', 'Ibu Tiga', '081100000003', false),
    ('f8000000-0000-0000-0000-000000000004', 'Pasien Empat Asli', 'Empat', 'Ibu Empat', '081100000004', false),
    ('f8000000-0000-0000-0000-000000000005', 'Pasien Lima Asli', 'Lima', 'Ibu Lima', '081100000005', false),
    ('f8000000-0000-0000-0000-000000000006', 'Pasien Enam Rahasia', 'Enam', 'Ibu Enam', '081100000006', false)
ON CONFLICT (user_id) DO NOTHING;

-- Setup profil relawan
-- Relawan 1: Siaga (is_available = true)
-- Relawan 2: Non-siaga (is_available = false)
-- Relawan 3: Siaga tapi kuota habis (is_available = true)
INSERT INTO public.relawan_profiles (user_id, nama_lengkap, alias_name, latar_belakang, alasan_bergabung, total_sesi, is_available, topik_keahlian)
VALUES
    ('f8000000-0000-0000-0000-000000000010', 'Relawan Satu Uji', 'Kak Bintang', 'Psikologi', 'Mendengarkan', 0, true, ARRAY['Kecemasan', 'Stres']),
    ('f8000000-0000-0000-0000-000000000020', 'Relawan Dua Uji', 'Kak Awan', 'Konseling', 'Membantu', 0, false, ARRAY['Depresi', 'Karier']),
    ('f8000000-0000-0000-0000-000000000030', 'Relawan Tiga Uji', 'Kak Surya', 'Pendidikan', 'Berbagi', 0, true, ARRAY['Keluarga', 'Relasi'])
ON CONFLICT (user_id) DO UPDATE SET is_available = EXCLUDED.is_available;

-- Kuota hari ini: Relawan 3 kuota habis (3 tiket claimed, quota limit = 3)
INSERT INTO public.relawan_daily_quota (relawan_id, quota_date, tickets_claimed, penalty_points)
VALUES
    ('f8000000-0000-0000-0000-000000000030', (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::DATE, 3, 0)
ON CONFLICT (relawan_id, quota_date) DO UPDATE SET tickets_claimed = 3, penalty_points = 0;

-- Pastikan system_settings relawan diset sesuai standar
INSERT INTO public.system_settings (key, value)
VALUES
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24, "max_carry_penalty": 1}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Pastikan tabel notifications ada
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Pastikan notify_internal ada
CREATE OR REPLACE FUNCTION public.notify_internal(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        link,
        created_at
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_body,
        p_link,
        pg_catalog.now()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Pastikan tabel peer_tickets ada
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
    closed_by TEXT NULL CHECK (closed_by IN ('pasien', 'relawan', 'system')),
    archived_at TIMESTAMPTZ NULL,
    abandoned_by UUID[] NOT NULL DEFAULT '{}',
    greeting_reminded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Pastikan tabel peer_reviews ada
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

-- Pastikan tabel tips ada
CREATE TABLE IF NOT EXISTS public.tips (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    coins BIGINT NOT NULL CHECK (coins > 0),
    mitra_share_bps INTEGER NOT NULL CHECK (mitra_share_bps BETWEEN 0 AND 10000),
    source_type TEXT NOT NULL CHECK (source_type IN ('session', 'ticket')),
    source_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT tips_source_once UNIQUE (source_type, source_id)
);

-- Pastikan tabel peer_messages ada
CREATE TABLE IF NOT EXISTS public.peer_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice')),
    body TEXT NULL CHECK (body IS NULL OR pg_catalog.char_length(body) <= 4000),
    media_path TEXT NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ========================================================
-- 2. DDL MIGRATION 20261031000027_peer_notifications.sql
-- ========================================================

-- Penambahan kolom greeting_reminded_at
ALTER TABLE public.peer_tickets
    ADD COLUMN IF NOT EXISTS greeting_reminded_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.peer_tickets.greeting_reminded_at IS 'Waktu pengiriman pengingat sisa batas sapaan 3 menit ke relawan';

-- Trigger reset penanda peringatan
CREATE OR REPLACE FUNCTION public.trg_peer_tickets_reset_reminders_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'open'::public.peer_ticket_status OR (NEW.claimed_by IS DISTINCT FROM OLD.claimed_by) THEN
        NEW.greeting_reminded_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_tickets_reset_reminders_before_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_tickets_reset_reminders_before_update() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_tickets_reset_reminders ON public.peer_tickets;
CREATE TRIGGER trg_peer_tickets_reset_reminders
    BEFORE UPDATE OF status, claimed_by ON public.peer_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tickets_reset_reminders_before_update();

-- Pembaruan RPC peer_ticket_tick()
CREATE OR REPLACE FUNCTION public.peer_ticket_tick()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_response_mins INTEGER;
    v_archive_hours INTEGER;
    v_reminded_count INTEGER := 0;
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

    -- 2. Peringatan sisa waktu sapaan (sisa 3 menit / menit ke-7 s.d. sebelum timeout)
    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'claimed'::public.peer_ticket_status
          AND claimed_by IS NOT NULL
          AND claimed_at IS NOT NULL
          AND greeting_reminded_at IS NULL
          AND pg_catalog.now() >= claimed_at + INTERVAL '7 minutes'
          AND pg_catalog.now() < claimed_at + (v_response_mins * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.peer_tickets
        SET greeting_reminded_at = pg_catalog.now(),
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        PERFORM public.notify_internal(
            r_ticket.claimed_by,
            'peer_greeting_reminder_3',
            'Peringatan Sisa Waktu Menyapa',
            'Waktu menyapa teman curhat tersisa 3 menit. Segera kirim sapaan pertama sebelum tiket dibatalkan.',
            '/listener/peer-room/' || r_ticket.id
        );

        v_reminded_count := v_reminded_count + 1;
    END LOOP;

    -- 3. Tangani tiket claimed yang timeout (> claim_response_minutes tanpa first response)
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
            greeting_reminded_at = NULL,
            abandoned_by = v_new_abandoned,
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_timeout_count := v_timeout_count + 1;
    END LOOP;

    -- 4. Arsipkan tiket open yang > 24 jam belum diklaim siapapun
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

    -- 5. Tutup tiket active yang melebihi 24 jam sejak balasan pertama (first_response_at)
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
        'reminded_count', v_reminded_count,
        'timeout_count', v_timeout_count,
        'archived_count', v_archived_count,
        'closed_count', v_closed_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_tick() TO service_role;

-- Trigger Pool Antrean Tiket Baru
CREATE OR REPLACE FUNCTION public.trg_peer_tickets_notify_pool_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_daily_quota INTEGER;
    v_today_wib DATE;
    r_relawan RECORD;
BEGIN
    IF NEW.status <> 'open'::public.peer_ticket_status THEN
        RETURN NEW;
    END IF;

    SELECT
        COALESCE(
            (value->>'daily_ticket_quota')::INTEGER,
            (value->'relawan'->>'daily_ticket_quota')::INTEGER,
            3
        )
    INTO v_daily_quota
    FROM public.system_settings
    WHERE key = 'relawan';

    v_daily_quota := COALESCE(v_daily_quota, 3);
    v_today_wib := (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::DATE;

    FOR r_relawan IN
        SELECT u.id
        FROM public.users u
        JOIN public.relawan_profiles rp ON rp.user_id = u.id
        LEFT JOIN public.relawan_daily_quota q
            ON q.relawan_id = u.id AND q.quota_date = v_today_wib
        WHERE u.role = 'relawan'::public.user_role
          AND u.status = 'active'::public.account_status
          AND rp.is_available = true
          AND (COALESCE(q.tickets_claimed, 0) + COALESCE(q.penalty_points, 0)) < v_daily_quota
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = u.id
                AND n.type = 'peer_pool_new_ticket'
                AND n.created_at >= pg_catalog.now() - INTERVAL '15 minutes'
          )
    LOOP
        PERFORM public.notify_internal(
            r_relawan.id,
            'peer_pool_new_ticket',
            'Tiket Curhat Baru',
            'Ada teman bicara yang membutuhkan pendengar sebaya. Buka antrean sekarang.',
            '/listener/queue'
        );
    END LOOP;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_tickets_notify_pool_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_tickets_notify_pool_after_insert() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_tickets_notify_pool ON public.peer_tickets;
CREATE TRIGGER trg_peer_tickets_notify_pool
    AFTER INSERT ON public.peer_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tickets_notify_pool_after_insert();

-- Trigger Siklus Status Tiket
CREATE OR REPLACE FUNCTION public.trg_peer_tickets_notify_status_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Kasus 3: Timeout Sapaan / Reopen (claimed -> open)
    IF OLD.status = 'claimed'::public.peer_ticket_status AND NEW.status = 'open'::public.peer_ticket_status THEN
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_ticket_reopened',
            'Mencari Pendengar Pengganti',
            'Pendengar sebaya sebelumnya melewati batas waktu sapaan. Tiketmu kembali ke antrean untuk pendengar lain.',
            '/patient/beranda'
        );

        IF OLD.claimed_by IS NOT NULL THEN
            PERFORM public.notify_internal(
                OLD.claimed_by,
                'peer_claim_timeout',
                'Klaim Tiket Dibatalkan',
                'Klaim tiket dibatalkan karena Anda belum mengirim pesan sapaan dalam batas waktu 10 menit.',
                '/listener/queue'
            );
        END IF;

    -- Kasus 1: Tiket Diklaim (status -> claimed)
    ELSIF NEW.status = 'claimed'::public.peer_ticket_status THEN
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_ticket_claimed',
            'Pendengar Sebaya Ditemukan',
            'Pendengar sebaya telah menerima tiket curhatmu dan sedang bersiap menyapa.',
            '/patient/peer-room/' || NEW.id
        );

    -- Kasus 2: Sesi Dimulai (status -> active)
    ELSIF NEW.status = 'active'::public.peer_ticket_status THEN
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_session_started',
            'Sesi Curhat Dimulai',
            'Pendengar sebaya telah menyapa. Sesi Ruang Dengar telah dimulai.',
            '/patient/peer-room/' || NEW.id
        );

    -- Kasus 4: Sesi Ditutup (status -> closed)
    ELSIF NEW.status = 'closed'::public.peer_ticket_status THEN
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_session_closed',
            'Sesi Curhat Selesai',
            'Sesi curhat telah selesai. Terima kasih telah berbagi di Ruang Dengar.',
            '/patient/peer-room/' || NEW.id
        );

        IF NEW.closed_by = 'pasien' AND NEW.claimed_by IS NOT NULL THEN
            PERFORM public.notify_internal(
                NEW.claimed_by,
                'peer_session_closed_by_patient',
                'Sesi Diakhiri Teman Bicara',
                'Teman bicara telah mengakhiri sesi curhat di Ruang Dengar.',
                '/listener/peer-room/' || NEW.id
            );
        END IF;

    -- Kasus 5: Tiket Diarsipkan (status -> archived)
    ELSIF NEW.status = 'archived'::public.peer_ticket_status THEN
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_ticket_archived',
            'Tiket Curhat Berakhir',
            'Belum ada pendengar sebaya yang siaga saat ini. Bebanmu valid dan kamu tidak sendirian.',
            '/patient/beranda'
        );
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_tickets_notify_status_after_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_tickets_notify_status_after_update() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_tickets_notify_status ON public.peer_tickets;
CREATE TRIGGER trg_peer_tickets_notify_status
    AFTER UPDATE ON public.peer_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tickets_notify_status_after_update();

-- Trigger Ulasan Bintang
CREATE OR REPLACE FUNCTION public.trg_peer_reviews_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.notify_internal(
        NEW.relawan_id,
        'peer_review_received',
        'Ulasan Bintang Baru',
        'Anda menerima ulasan ' || NEW.rating::text || ' bintang dari teman curhat.',
        '/listener/beranda'
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_reviews_notify_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_reviews_notify_after_insert() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_reviews_notify ON public.peer_reviews;
CREATE TRIGGER trg_peer_reviews_notify
    AFTER INSERT ON public.peer_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_reviews_notify_after_insert();

-- Trigger Tip Koin Apresiasi
CREATE OR REPLACE FUNCTION public.trg_peer_tips_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.source_type = 'ticket' THEN
        PERFORM public.notify_internal(
            NEW.mitra_id,
            'peer_tip_received',
            'Tip Apresiasi Diterima',
            'Anda menerima tip apresiasi sebesar ' || NEW.coins::text || ' koin dari teman curhat.',
            '/listener/earnings'
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_tips_notify_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_tips_notify_after_insert() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_tips_notify_insert ON public.tips;
CREATE TRIGGER trg_peer_tips_notify_insert
    AFTER INSERT ON public.tips
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tips_notify_after_insert();

-- Trigger Pesan Baru Ruang Dengar
CREATE OR REPLACE FUNCTION public.trg_peer_messages_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets%ROWTYPE;
    v_recipient_id UUID;
    v_sender_label TEXT;
    v_link TEXT;
BEGIN
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = NEW.ticket_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF v_ticket.status <> 'active'::public.peer_ticket_status THEN
        RETURN NEW;
    END IF;

    IF NEW.sender_id = v_ticket.patient_id THEN
        v_recipient_id := v_ticket.claimed_by;
        v_sender_label := v_ticket.patient_alias;
        v_link := '/listener/peer-room/' || NEW.ticket_id;
    ELSIF NEW.sender_id = v_ticket.claimed_by THEN
        v_recipient_id := v_ticket.patient_id;
        v_sender_label := 'Pendengar Sebaya';
        v_link := '/patient/peer-room/' || NEW.ticket_id;
    ELSE
        RETURN NEW;
    END IF;

    IF v_recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient_id
          AND n.type = 'peer_new_message'
          AND n.link = v_link
          AND n.created_at >= pg_catalog.now() - INTERVAL '5 minutes'
    ) THEN
        PERFORM public.notify_internal(
            v_recipient_id,
            'peer_new_message',
            'Pesan Baru dari ' || v_sender_label,
            'Anda memiliki pesan baru di Ruang Dengar.',
            v_link
        );
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_messages_notify_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_messages_notify_after_insert() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_messages_notify ON public.peer_messages;
CREATE TRIGGER trg_peer_messages_notify
    AFTER INSERT ON public.peer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_messages_notify_after_insert();


-- ========================================================
-- 3. UJI 1: POOL ANTREAN TIKET BARU & DEBOUNCE 15 MENIT
-- ========================================================
DO $$
DECLARE
    v_r1_count INT;
    v_r2_count INT;
    v_r3_count INT;
    v_notif RECORD;
BEGIN
    -- Bersihkan notifikasi uji sebelumnya jika ada
    DELETE FROM public.notifications
    WHERE user_id IN (
        'f8000000-0000-0000-0000-000000000010',
        'f8000000-0000-0000-0000-000000000020',
        'f8000000-0000-0000-0000-000000000030'
    );

    -- 1. Insert tiket open pertama oleh Pasien 1
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous, status
    ) VALUES (
        'd1000000-0000-0000-0000-000000000001',
        'f8000000-0000-0000-0000-000000000001',
        'Mawar Jingga',
        'Kecemasan Akademik',
        'Cemas',
        'Saya merasa sangat cemas dengan skripsi dan masa depan.',
        true,
        'open'
    );

    -- Assert: Relawan 1 (siaga berkuota) menerima notifikasi
    SELECT count(*) INTO v_r1_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_pool_new_ticket';

    IF v_r1_count <> 1 THEN
        RAISE EXCEPTION 'UJI 1.1 GAGAL: Relawan 1 siaga berkuota harus menerima 1 notifikasi pool, didapat: %', v_r1_count;
    END IF;

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_pool_new_ticket';

    IF v_notif.link <> '/listener/queue' THEN
        RAISE EXCEPTION 'UJI 1.1 GAGAL: Link notifikasi pool harus /listener/queue, didapat: %', v_notif.link;
    END IF;

    -- Assert: Relawan 2 (non-siaga) tidak menerima notifikasi
    SELECT count(*) INTO v_r2_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000020'
      AND type = 'peer_pool_new_ticket';

    IF v_r2_count <> 0 THEN
        RAISE EXCEPTION 'UJI 1.2 GAGAL: Relawan 2 non-siaga tidak boleh menerima notifikasi pool, didapat: %', v_r2_count;
    END IF;

    -- Assert: Relawan 3 (kuota habis) tidak menerima notifikasi
    SELECT count(*) INTO v_r3_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000030'
      AND type = 'peer_pool_new_ticket';

    IF v_r3_count <> 0 THEN
        RAISE EXCEPTION 'UJI 1.3 GAGAL: Relawan 3 kuota habis tidak boleh menerima notifikasi pool, didapat: %', v_r3_count;
    END IF;

    -- 2. Insert tiket open kedua oleh Pasien 2 dalam jendela 15 menit
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous, status
    ) VALUES (
        'd1000000-0000-0000-0000-000000000002',
        'f8000000-0000-0000-0000-000000000002',
        'Melati Putih',
        'Karier',
        'Bingung',
        'Bingung memilih kesempatan magang pertama.',
        true,
        'open'
    );

    -- Assert Debounce: Relawan 1 tetap hanya memiliki 1 notifikasi
    SELECT count(*) INTO v_r1_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_pool_new_ticket';

    IF v_r1_count <> 1 THEN
        RAISE EXCEPTION 'UJI 1.4 GAGAL: Debounce 15 menit gagal, Relawan 1 menerima notifikasi ganda: %', v_r1_count;
    END IF;
END $$;


-- ========================================================
-- 4. UJI 2: TIKET DIKLAIM (STATUS -> CLAIMED)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
BEGIN
    UPDATE public.peer_tickets
    SET
        status = 'claimed'::public.peer_ticket_status,
        claimed_by = 'f8000000-0000-0000-0000-000000000010',
        claimed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = 'd1000000-0000-0000-0000-000000000001';

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000001'
      AND type = 'peer_ticket_claimed';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Pasien 1 harus menerima notifikasi peer_ticket_claimed saat tiket diklaim';
    END IF;

    IF v_notif.link <> '/patient/peer-room/d1000000-0000-0000-0000-000000000001' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Link notifikasi peer_ticket_claimed tidak tepat, didapat: %', v_notif.link;
    END IF;

    IF v_notif.title <> 'Pendengar Sebaya Ditemukan' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Judul notifikasi peer_ticket_claimed tidak tepat: %', v_notif.title;
    END IF;
END $$;


-- ========================================================
-- 5. UJI 3: SESI DIMULAI VIA FIRST RESPONSE (STATUS -> ACTIVE)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
BEGIN
    UPDATE public.peer_tickets
    SET
        status = 'active'::public.peer_ticket_status,
        first_response_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = 'd1000000-0000-0000-0000-000000000001';

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000001'
      AND type = 'peer_session_started';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Pasien 1 harus menerima notifikasi peer_session_started saat status berubah ke active';
    END IF;

    IF v_notif.link <> '/patient/peer-room/d1000000-0000-0000-0000-000000000001' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Link notifikasi peer_session_started tidak tepat, didapat: %', v_notif.link;
    END IF;

    IF v_notif.title <> 'Sesi Curhat Dimulai' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Judul notifikasi peer_session_started tidak tepat: %', v_notif.title;
    END IF;
END $$;


-- ========================================================
-- 6. UJI 4: PERINGATAN SISA WAKTU MENYAPA (PEER_TICKET_TICK SISA 3 MENIT)
-- ========================================================
DO $$
DECLARE
    v_ticket RECORD;
    v_notif RECORD;
    v_tick_res JSONB;
    v_reminder_count INT;
BEGIN
    -- Setup tiket 3: claimed 8 menit lalu oleh Relawan 1 (jendela 7-10 menit, sisa 2-3 menit)
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
        status, claimed_by, claimed_at, greeting_reminded_at
    ) VALUES (
        'd1000000-0000-0000-0000-000000000003',
        'f8000000-0000-0000-0000-000000000003',
        'Bunga Sakura',
        'Hubungan',
        'Sedih',
        'Sedang merasa sedih karena perselisihan dengan teman.',
        true,
        'claimed',
        'f8000000-0000-0000-0000-000000000010',
        pg_catalog.now() - INTERVAL '8 minutes',
        NULL
    );

    -- Jalankan cron tick
    v_tick_res := public.peer_ticket_tick();

    IF (v_tick_res->>'reminded_count')::INT < 1 THEN
        RAISE EXCEPTION 'UJI 4.1 GAGAL: peer_ticket_tick harus mencatat reminded_count >= 1, hasil: %', v_tick_res;
    END IF;

    -- Verifikasi kolom greeting_reminded_at terisi pada tiket
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = 'd1000000-0000-0000-0000-000000000003';

    IF v_ticket.greeting_reminded_at IS NULL THEN
        RAISE EXCEPTION 'UJI 4.2 GAGAL: Kolom greeting_reminded_at harus terisi stempel waktu setelah diingatkan';
    END IF;

    -- Verifikasi notifikasi terkirim ke Relawan 1
    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_greeting_reminder_3'
      AND link = '/listener/peer-room/d1000000-0000-0000-0000-000000000003';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 4.3 GAGAL: Notifikasi peer_greeting_reminder_3 tidak ditemukan untuk Relawan 1';
    END IF;

    IF v_notif.title <> 'Peringatan Sisa Waktu Menyapa' THEN
        RAISE EXCEPTION 'UJI 4.3 GAGAL: Judul notifikasi pengingat sisa waktu salah: %', v_notif.title;
    END IF;

    -- Verifikasi Idempotensi: Eksekusi tick kedua kali TIDAK boleh mengirim notifikasi pengingat ulang
    v_tick_res := public.peer_ticket_tick();

    SELECT count(*) INTO v_reminder_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_greeting_reminder_3'
      AND link = '/listener/peer-room/d1000000-0000-0000-0000-000000000003';

    IF v_reminder_count <> 1 THEN
        RAISE EXCEPTION 'UJI 4.4 GAGAL: Peringatan sisa 3 menit terkirim ganda (idempotensi gagal), total notifikasi: %', v_reminder_count;
    END IF;
END $$;


-- ========================================================
-- 7. UJI 5: TIMEOUT SAPAAN 10 MENIT (PEER_TICKET_TICK TIMEOUT REOPEN)
-- ========================================================
DO $$
DECLARE
    v_ticket RECORD;
    v_notif_pasien RECORD;
    v_notif_relawan RECORD;
    v_tick_res JSONB;
BEGIN
    -- Setup tiket 4: claimed 11 menit lalu oleh Relawan 1 (sudah lewat 10 menit)
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
        status, claimed_by, claimed_at, greeting_reminded_at
    ) VALUES (
        'd1000000-0000-0000-0000-000000000004',
        'f8000000-0000-0000-0000-000000000004',
        'Bintang Kejora',
        'Keluarga',
        'Lelah',
        'Merasa lelah dengan ekspektasi keluarga yang tinggi.',
        true,
        'claimed',
        'f8000000-0000-0000-0000-000000000010',
        pg_catalog.now() - INTERVAL '11 minutes',
        pg_catalog.now() - INTERVAL '3 minutes'
    );

    -- Jalankan cron tick
    v_tick_res := public.peer_ticket_tick();

    IF (v_tick_res->>'timeout_count')::INT < 1 THEN
        RAISE EXCEPTION 'UJI 5.1 GAGAL: peer_ticket_tick harus mencatat timeout_count >= 1, hasil: %', v_tick_res;
    END IF;

    -- Verifikasi tiket kembali ke open dan penanda greeting_reminded_at direset NULL
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = 'd1000000-0000-0000-0000-000000000004';

    IF v_ticket.status <> 'open'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'UJI 5.2 GAGAL: Status tiket timeout harus kembali open, didapat: %', v_ticket.status;
    END IF;

    IF v_ticket.claimed_by IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 5.2 GAGAL: claimed_by harus NULL setelah timeout, didapat: %', v_ticket.claimed_by;
    END IF;

    IF v_ticket.greeting_reminded_at IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 5.2 GAGAL: greeting_reminded_at harus direset NULL saat tiket kembali open';
    END IF;

    -- Verifikasi notifikasi ke Pasien 4: peer_ticket_reopened
    SELECT * INTO v_notif_pasien
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000004'
      AND type = 'peer_ticket_reopened';

    IF v_notif_pasien.id IS NULL THEN
        RAISE EXCEPTION 'UJI 5.3 GAGAL: Pasien 4 harus menerima notifikasi peer_ticket_reopened saat klaim dibatalkan';
    END IF;

    IF v_notif_pasien.link <> '/patient/beranda' THEN
        RAISE EXCEPTION 'UJI 5.3 GAGAL: Link notifikasi peer_ticket_reopened harus /patient/beranda, didapat: %', v_notif_pasien.link;
    END IF;

    -- Verifikasi notifikasi ke Relawan 1: peer_claim_timeout
    SELECT * INTO v_notif_relawan
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_claim_timeout';

    IF v_notif_relawan.id IS NULL THEN
        RAISE EXCEPTION 'UJI 5.4 GAGAL: Relawan 1 harus menerima notifikasi peer_claim_timeout saat melewati batas sapaan';
    END IF;

    IF v_notif_relawan.link <> '/listener/queue' THEN
        RAISE EXCEPTION 'UJI 5.4 GAGAL: Link notifikasi peer_claim_timeout harus /listener/queue, didapat: %', v_notif_relawan.link;
    END IF;
END $$;


-- ========================================================
-- 8. UJI 6: SESI DITUTUP (STATUS -> CLOSED OLEH PASIEN)
-- ========================================================
DO $$
DECLARE
    v_notif_pasien RECORD;
    v_notif_relawan RECORD;
BEGIN
    -- Tutup tiket 1 yang sebelumnya active dengan Pasien 1 & Relawan 1
    UPDATE public.peer_tickets
    SET
        status = 'closed'::public.peer_ticket_status,
        closed_by = 'pasien',
        closed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = 'd1000000-0000-0000-0000-000000000001';

    -- Pasien menerima notifikasi peer_session_closed
    SELECT * INTO v_notif_pasien
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000001'
      AND type = 'peer_session_closed';

    IF v_notif_pasien.id IS NULL THEN
        RAISE EXCEPTION 'UJI 6.1 GAGAL: Pasien 1 harus menerima notifikasi peer_session_closed saat sesi ditutup';
    END IF;

    IF v_notif_pasien.link <> '/patient/peer-room/d1000000-0000-0000-0000-000000000001' THEN
        RAISE EXCEPTION 'UJI 6.1 GAGAL: Link notifikasi peer_session_closed salah: %', v_notif_pasien.link;
    END IF;

    -- Relawan menerima notifikasi peer_session_closed_by_patient
    SELECT * INTO v_notif_relawan
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_session_closed_by_patient';

    IF v_notif_relawan.id IS NULL THEN
        RAISE EXCEPTION 'UJI 6.2 GAGAL: Relawan 1 harus menerima notifikasi peer_session_closed_by_patient jika ditutup pasien';
    END IF;

    IF v_notif_relawan.link <> '/listener/peer-room/d1000000-0000-0000-0000-000000000001' THEN
        RAISE EXCEPTION 'UJI 6.2 GAGAL: Link notifikasi peer_session_closed_by_patient salah: %', v_notif_relawan.link;
    END IF;
END $$;


-- ========================================================
-- 9. UJI 7: PENGARSIPAN TIKET USANG (> 24 JAM OPEN)
-- ========================================================
DO $$
DECLARE
    v_ticket RECORD;
    v_notif RECORD;
    v_tick_res JSONB;
BEGIN
    -- Setup tiket 5: open dibuat 25 jam yang lalu
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
        status, created_at, updated_at
    ) VALUES (
        'd1000000-0000-0000-0000-000000000005',
        'f8000000-0000-0000-0000-000000000005',
        'Pelangi Senja',
        'Kesepian',
        'Hampa',
        'Merasa hampa dan sendiri dalam menghadapi tantangan.',
        true,
        'open',
        pg_catalog.now() - INTERVAL '25 hours',
        pg_catalog.now() - INTERVAL '25 hours'
    );

    -- Jalankan cron tick
    v_tick_res := public.peer_ticket_tick();

    IF (v_tick_res->>'archived_count')::INT < 1 THEN
        RAISE EXCEPTION 'UJI 7.1 GAGAL: peer_ticket_tick harus mencatat archived_count >= 1, hasil: %', v_tick_res;
    END IF;

    -- Verifikasi tiket berstatus archived
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = 'd1000000-0000-0000-0000-000000000005';

    IF v_ticket.status <> 'archived'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'UJI 7.2 GAGAL: Status tiket usang harus menjadi archived, didapat: %', v_ticket.status;
    END IF;

    -- Verifikasi notifikasi pasien
    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000005'
      AND type = 'peer_ticket_archived';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 7.3 GAGAL: Pasien 5 harus menerima notifikasi peer_ticket_archived saat tiket kedaluwarsa';
    END IF;

    IF v_notif.link <> '/patient/beranda' THEN
        RAISE EXCEPTION 'UJI 7.3 GAGAL: Link notifikasi peer_ticket_archived harus /patient/beranda, didapat: %', v_notif.link;
    END IF;
END $$;


-- ========================================================
-- 10. UJI 8: ULASAN BINTANG BARU (PEER_REVIEWS -> NOTIFIKASI RELAWAN)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
BEGIN
    INSERT INTO public.peer_reviews (
        ticket_id, patient_id, relawan_id, rating, review
    ) VALUES (
        'd1000000-0000-0000-0000-000000000001',
        'f8000000-0000-0000-0000-000000000001',
        'f8000000-0000-0000-0000-000000000010',
        5,
        'Terima kasih banyak sudah mendengarkan dengan tulus dan penuh pengertian.'
    );

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_review_received';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Relawan 1 harus menerima notifikasi peer_review_received setelah pasien memberi ulasan';
    END IF;

    IF v_notif.link <> '/listener/beranda' THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Link notifikasi peer_review_received harus /listener/beranda, didapat: %', v_notif.link;
    END IF;

    IF v_notif.body <> 'Anda menerima ulasan 5 bintang dari teman curhat.' THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Isi pesan peer_review_received tidak tepat: %', v_notif.body;
    END IF;
END $$;


-- ========================================================
-- 11. UJI 9: TIP KOIN APRESIASI TIKET (TIPS -> NOTIFIKASI RELAWAN)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
BEGIN
    INSERT INTO public.tips (
        patient_id, mitra_id, coins, mitra_share_bps, source_type, source_id
    ) VALUES (
        'f8000000-0000-0000-0000-000000000001',
        'f8000000-0000-0000-0000-000000000010',
        5,
        8500,
        'ticket',
        'd1000000-0000-0000-0000-000000000001'
    );

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_tip_received';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 9 GAGAL: Relawan 1 harus menerima notifikasi peer_tip_received atas tip apresiasi tiket';
    END IF;

    IF v_notif.link <> '/listener/earnings' THEN
        RAISE EXCEPTION 'UJI 9 GAGAL: Link notifikasi peer_tip_received harus /listener/earnings, didapat: %', v_notif.link;
    END IF;

    IF v_notif.body <> 'Anda menerima tip apresiasi sebesar 5 koin dari teman curhat.' THEN
        RAISE EXCEPTION 'UJI 9 GAGAL: Isi pesan peer_tip_received tidak tepat: %', v_notif.body;
    END IF;
END $$;


-- ========================================================
-- 12. UJI 10: PESAN BARU DI RUANG DENGAR (RATE-LIMIT & PRIVASI)
-- ========================================================
DO $$
DECLARE
    v_notif_relawan RECORD;
    v_notif_pasien RECORD;
    v_msg_count INT;
BEGIN
    -- Setup tiket 6: active antara Pasien 6 dan Relawan 1
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
        status, claimed_by, claimed_at, first_response_at
    ) VALUES (
        'd1000000-0000-0000-0000-000000000006',
        'f8000000-0000-0000-0000-000000000006',
        'Teratai Biru',
        'Kecemasan Rahasia',
        'Gelisah',
        'Ini cerita rahasia yang sangat pribadi jangan sampai bocor.',
        true,
        'active',
        'f8000000-0000-0000-0000-000000000010',
        pg_catalog.now() - INTERVAL '5 minutes',
        pg_catalog.now() - INTERVAL '4 minutes'
    );

    -- 1. Pasien 6 mengirim pesan teks pertama ke Ruang Dengar
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'd1000000-0000-0000-0000-000000000006',
        'f8000000-0000-0000-0000-000000000006',
        'text',
        'Halo kak Bintang, saya mau cerita beban yang saya pendam.'
    );

    -- Assert: Relawan 1 menerima notifikasi pesan baru
    SELECT * INTO v_notif_relawan
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_new_message'
      AND link = '/listener/peer-room/d1000000-0000-0000-0000-000000000006';

    IF v_notif_relawan.id IS NULL THEN
        RAISE EXCEPTION 'UJI 10.1 GAGAL: Relawan 1 harus menerima notifikasi pesan baru dari lawan bicara';
    END IF;

    -- Assert Anonimitas & Privasi: Memakai alias pasien, tidak memuat nama asli atau teks curhat
    IF v_notif_relawan.title <> 'Pesan Baru dari Teratai Biru' THEN
        RAISE EXCEPTION 'UJI 10.2 GAGAL: Judul harus menggunakan alias pasien Teratai Biru, didapat: %', v_notif_relawan.title;
    END IF;

    IF v_notif_relawan.title LIKE '%Pasien Enam Rahasia%' OR v_notif_relawan.body LIKE '%Pasien Enam Rahasia%' THEN
        RAISE EXCEPTION 'UJI 10.2 GAGAL: Kebocoran nama asli pasien pada notifikasi';
    END IF;

    IF v_notif_relawan.title LIKE '%beban yang saya pendam%' OR v_notif_relawan.body LIKE '%beban yang saya pendam%' THEN
        RAISE EXCEPTION 'UJI 10.2 GAGAL: Kebocoran teks percakapan pada notifikasi';
    END IF;

    -- 2. Pasien 6 mengirim pesan kedua segera setelahnya (dalam 5 menit)
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'd1000000-0000-0000-0000-000000000006',
        'f8000000-0000-0000-0000-000000000006',
        'text',
        'Pesan kedua cepat berturut-turut.'
    );

    -- Assert Rate Limit: Relawan 1 tetap hanya menerima 1 notifikasi peer_new_message untuk tiket ini
    SELECT count(*) INTO v_msg_count
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000010'
      AND type = 'peer_new_message'
      AND link = '/listener/peer-room/d1000000-0000-0000-0000-000000000006';

    IF v_msg_count <> 1 THEN
        RAISE EXCEPTION 'UJI 10.3 GAGAL: Rate-limit 5 menit pesan baru gagal, total notifikasi: %', v_msg_count;
    END IF;

    -- 3. Relawan 1 membalas pesan
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'd1000000-0000-0000-0000-000000000006',
        'f8000000-0000-0000-0000-000000000010',
        'text',
        'Halo Teratai Biru, silakan ceritakan pelan-pelan. Aku mendengarkan.'
    );

    -- Assert: Pasien 6 menerima notifikasi dengan label 'Pendengar Sebaya'
    SELECT * INTO v_notif_pasien
    FROM public.notifications
    WHERE user_id = 'f8000000-0000-0000-0000-000000000006'
      AND type = 'peer_new_message'
      AND link = '/patient/peer-room/d1000000-0000-0000-0000-000000000006';

    IF v_notif_pasien.id IS NULL THEN
        RAISE EXCEPTION 'UJI 10.4 GAGAL: Pasien 6 harus menerima notifikasi saat relawan membalas pesan';
    END IF;

    IF v_notif_pasien.title <> 'Pesan Baru dari Pendengar Sebaya' THEN
        RAISE EXCEPTION 'UJI 10.4 GAGAL: Judul notifikasi untuk pasien harus Pendengar Sebaya, didapat: %', v_notif_pasien.title;
    END IF;
END $$;


-- ========================================================
-- 13. UJI 11: VERIFIKASI KEAMANAN FUNGSI (SECURITY DEFINER & SEARCH_PATH)
-- ========================================================
DO $$
DECLARE
    r_fn RECORD;
    v_fn_names TEXT[] := ARRAY[
        'trg_peer_tickets_reset_reminders_before_update',
        'peer_ticket_tick',
        'trg_peer_tickets_notify_pool_after_insert',
        'trg_peer_tickets_notify_status_after_update',
        'trg_peer_reviews_notify_after_insert',
        'trg_peer_tips_notify_after_insert',
        'trg_peer_messages_notify_after_insert'
    ];
    v_name TEXT;
BEGIN
    FOREACH v_name IN ARRAY v_fn_names LOOP
        SELECT proname, prosecdef, proconfig
        INTO r_fn
        FROM pg_proc
        JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
        WHERE n.nspname = 'public'
          AND proname = v_name;

        IF r_fn.proname IS NULL THEN
            RAISE EXCEPTION 'UJI 11 GAGAL: Fungsi % tidak ditemukan di skema public', v_name;
        END IF;

        IF NOT r_fn.prosecdef THEN
            RAISE EXCEPTION 'UJI 11 GAGAL: Fungsi % wajib bertipe SECURITY DEFINER', v_name;
        END IF;

        IF r_fn.proconfig IS NULL OR NOT ('search_path=' = ANY(r_fn.proconfig)) THEN
            RAISE EXCEPTION 'UJI 11 GAGAL: Fungsi % wajib memiliki SET search_path = ''''', v_name;
        END IF;
    END LOOP;
END $$;


-- ========================================================
-- KESIMPULAN SUITE PENGUJIAN
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'SELURUH UJI DRY-RUN MIGRASI 000027 NOTIFIKASI CURHAT SEBAYA LULUS SEMPURNA.';
END $$;

ROLLBACK;
