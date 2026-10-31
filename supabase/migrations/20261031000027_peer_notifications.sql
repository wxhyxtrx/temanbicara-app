-- ========================================================
-- TEMAN BICARA: NOTIFIKASI IN-APP SUBSISTEM CURHAT SEBAYA (PRD-027)
-- Migration: 20261031000027_peer_notifications.sql
-- ========================================================

-- 1. PENAMBAHAN KOLOM PADA PUBLIC.PEER_TICKETS
ALTER TABLE public.peer_tickets
    ADD COLUMN IF NOT EXISTS greeting_reminded_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.peer_tickets.greeting_reminded_at IS 'Waktu pengiriman pengingat sisa batas sapaan 3 menit ke relawan';

-- 2. TRIGGER RESET PENANDA PERINGATAN (BEFORE UPDATE)
-- Kolom greeting_reminded_at direset menjadi NULL saat tiket kembali ke status open
-- atau saat tiket diklaim oleh relawan baru (claimed_by berubah)
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

-- 3. PEMBARUAN RPC PUBLIC.PEER_TICKET_TICK()
-- Menambahkan langkah peringatan sisa 3 menit (peer_greeting_reminder_3)
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

COMMENT ON FUNCTION public.peer_ticket_tick() IS 'Cron worker untuk pengingat sapaan 3 menit, penalti timeout claimed, pengarsipan open kedaluwarsa, dan penutupan otomatis sesi active > 24 jam';

-- 4. TRIGGER POOL ANTREAN TIKET BARU (AFTER INSERT ON PUBLIC.PEER_TICKETS)
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

    -- Baca daily_ticket_quota dari system_settings key 'relawan' (default 3)
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

-- 5. TRIGGER SIKLUS STATUS TIKET (AFTER UPDATE ON PUBLIC.PEER_TICKETS)
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
        -- Pasien
        PERFORM public.notify_internal(
            NEW.patient_id,
            'peer_ticket_reopened',
            'Mencari Pendengar Pengganti',
            'Pendengar sebaya sebelumnya melewati batas waktu sapaan. Tiketmu kembali ke antrean untuk pendengar lain.',
            '/patient/beranda'
        );

        -- Relawan yang klaimnya dicabut
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

-- 6. TRIGGER ULASAN BINTANG (AFTER INSERT ON PUBLIC.PEER_REVIEWS)
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

-- 7. TRIGGER TIP KOIN TIKET (AFTER INSERT ON PUBLIC.TIPS)
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

-- 8. TRIGGER PESAN BARU RUANG DENGAR (AFTER INSERT ON PUBLIC.PEER_MESSAGES)
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

    -- Notifikasi pesan hanya berlaku jika tiket berstatus active
    IF v_ticket.status <> 'active'::public.peer_ticket_status THEN
        RETURN NEW;
    END IF;

    -- Tentukan lawan bicara (penerima notifikasi)
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

    -- Rate-limit anti-spam: maksimal 1 notifikasi peer_new_message per 5 menit per tiket
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
