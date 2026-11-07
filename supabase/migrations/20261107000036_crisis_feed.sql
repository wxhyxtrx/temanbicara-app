-- ========================================================
-- TEMAN BICARA: TABEL CRISIS_ALERTS, AUDIT LOG & TRIGGER DETEKSI KRISIS (PRD-036)
-- Migration: 20261107000036_crisis_feed.sql
-- ========================================================

-- 1. TABEL CRISIS_ALERTS
CREATE TABLE IF NOT EXISTS public.crisis_alerts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('booking', 'peer_ticket')),
    booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    ticket_id UUID NULL REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    detected_by TEXT NOT NULL CHECK (detected_by IN ('keyword', 'manual')),
    reporter_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'self_harm_risk',
    snippet TEXT NULL CHECK (snippet IS NULL OR pg_catalog.char_length(snippet) <= 100),
    hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 1),
    status TEXT NOT NULL CHECK (status IN ('new', 'handled', 'false_alarm')) DEFAULT 'new',
    handled_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ NULL,
    admin_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_crisis_alerts_target CHECK (
        (source = 'booking' AND booking_id IS NOT NULL AND ticket_id IS NULL) OR
        (source = 'peer_ticket' AND ticket_id IS NOT NULL AND booking_id IS NULL)
    )
);

COMMENT ON TABLE public.crisis_alerts IS 'Tabel peringatan eskalasi krisis keselamatan diri pasien untuk penanganan cepat oleh admin';
COMMENT ON COLUMN public.crisis_alerts.id IS 'Primary key UUID alert krisis';
COMMENT ON COLUMN public.crisis_alerts.source IS 'Sumber ruang percakapan: booking (konseling) atau peer_ticket (curhat)';
COMMENT ON COLUMN public.crisis_alerts.booking_id IS 'ID booking jika sumber adalah sesi konseling';
COMMENT ON COLUMN public.crisis_alerts.ticket_id IS 'ID tiket curhat jika sumber adalah Ruang Dengar';
COMMENT ON COLUMN public.crisis_alerts.patient_id IS 'ID pasien yang mengalami krisis';
COMMENT ON COLUMN public.crisis_alerts.detected_by IS 'Metode deteksi krisis: keyword (otomatis) atau manual (laporan pendamping)';
COMMENT ON COLUMN public.crisis_alerts.reporter_id IS 'ID pendamping (psikolog/relawan) jika dilaporkan secara manual';
COMMENT ON COLUMN public.crisis_alerts.category IS 'Kategori risiko krisis (default self_harm_risk)';
COMMENT ON COLUMN public.crisis_alerts.snippet IS 'Potongan kalimat pemicu krisis maksimal 100 karakter';
COMMENT ON COLUMN public.crisis_alerts.hit_count IS 'Jumlah deteksi krisis yang terjadi selama alert berstatus new';
COMMENT ON COLUMN public.crisis_alerts.status IS 'Status penanganan alert: new, handled, atau false_alarm';
COMMENT ON COLUMN public.crisis_alerts.handled_by IS 'ID admin yang menangani alert';
COMMENT ON COLUMN public.crisis_alerts.handled_at IS 'Waktu alert ditangani atau ditandai false alarm';
COMMENT ON COLUMN public.crisis_alerts.admin_note IS 'Catatan penanganan oleh admin';
COMMENT ON COLUMN public.crisis_alerts.created_at IS 'Waktu pertama kali alert dibuat';

CREATE INDEX IF NOT EXISTS idx_crisis_alerts_status_created ON public.crisis_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_booking ON public.crisis_alerts (booking_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_ticket ON public.crisis_alerts (ticket_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_patient ON public.crisis_alerts (patient_id);

ALTER TABLE public.crisis_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crisis_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crisis_alerts TO service_role;

-- 2. KOLOM AUDIT LOG EMERGENCY_CONTACT_ACCESS_LOG
ALTER TABLE public.emergency_contact_access_log
    ADD COLUMN IF NOT EXISTS alert_id UUID NULL REFERENCES public.crisis_alerts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.emergency_contact_access_log.alert_id IS 'ID alert krisis terkait pembukaan data kontak darurat oleh admin';

CREATE INDEX IF NOT EXISTS idx_emergency_contact_access_log_alert
    ON public.emergency_contact_access_log (alert_id) WHERE alert_id IS NOT NULL;

-- 3. TRIGGER DETEKSI KATA KUNCI OTOMATIS (FAIL-SAFE NON-BLOCKING)
CREATE OR REPLACE FUNCTION public.trg_detect_crisis_keyword()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_table TEXT;
    v_source TEXT;
    v_booking_id UUID;
    v_ticket_id UUID;
    v_patient_id UUID;
    v_companion_id UUID;
    v_body_lower TEXT;
    v_matched BOOLEAN := FALSE;
    v_snippet TEXT;
    v_existing_alert_id UUID;
    v_alert_id UUID;
    r_admin RECORD;
BEGIN
    -- Evaluasi hanya untuk pesan teks yang memiliki isi
    IF NEW.kind IS DISTINCT FROM 'text' OR NEW.body IS NULL OR pg_catalog.btrim(NEW.body) = '' THEN
        RETURN NEW;
    END IF;

    -- Fail-safe non-blocking: kesalahan deteksi krisis tidak boleh menggagalkan insert pesan
    BEGIN
        v_table := pg_catalog.lower(TG_TABLE_NAME);

        IF v_table = 'session_messages' THEN
            v_source := 'booking';
            v_booking_id := NEW.booking_id;
            v_ticket_id := NULL;

            -- Pastikan pengirim adalah pasien terkait pada booking
            SELECT b.patient_id, b.psikolog_id
            INTO v_patient_id, v_companion_id
            FROM public.bookings b
            WHERE b.id = NEW.booking_id;

            IF v_patient_id IS NULL OR NEW.sender_id IS DISTINCT FROM v_patient_id THEN
                RETURN NEW;
            END IF;

        ELSIF v_table = 'peer_messages' THEN
            v_source := 'peer_ticket';
            v_booking_id := NULL;
            v_ticket_id := NEW.ticket_id;

            -- Pastikan pengirim adalah pasien terkait pada tiket
            SELECT t.patient_id, t.claimed_by
            INTO v_patient_id, v_companion_id
            FROM public.peer_tickets t
            WHERE t.id = NEW.ticket_id;

            IF v_patient_id IS NULL OR NEW.sender_id IS DISTINCT FROM v_patient_id THEN
                RETURN NEW;
            END IF;

        ELSE
            RETURN NEW;
        END IF;

        -- Deteksi kata kunci krisis bahasa Indonesia (lowercase substring match)
        v_body_lower := pg_catalog.lower(NEW.body);

        IF v_body_lower LIKE '%bunuh diri%' OR
           v_body_lower LIKE '%ingin mati%' OR
           v_body_lower LIKE '%mengakhiri hidup%' OR
           v_body_lower LIKE '%menyakiti diri%' OR
           v_body_lower LIKE '%self harm%' OR
           v_body_lower LIKE '%tidak ingin hidup%' OR
           v_body_lower LIKE '%mau mati%' OR
           v_body_lower LIKE '%akhiri hidup%' THEN
            v_matched := TRUE;
        END IF;

        IF NOT v_matched THEN
            RETURN NEW;
        END IF;

        -- Potongan kalimat pemicu krisis maks 100 karakter
        v_snippet := pg_catalog.substr(NEW.body, 1, 100);

        -- Aturan 1 alert terbuka: periksa apakah sudah ada alert berstatus 'new'
        IF v_source = 'booking' THEN
            SELECT id INTO v_existing_alert_id
            FROM public.crisis_alerts
            WHERE booking_id = v_booking_id AND status = 'new'
            ORDER BY created_at DESC
            LIMIT 1;
        ELSE
            SELECT id INTO v_existing_alert_id
            FROM public.crisis_alerts
            WHERE ticket_id = v_ticket_id AND status = 'new'
            ORDER BY created_at DESC
            LIMIT 1;
        END IF;

        -- Jika sudah ada alert 'new': naikkan hit_count, dilarang insert baru & dilarang notif ulang
        IF v_existing_alert_id IS NOT NULL THEN
            UPDATE public.crisis_alerts
            SET hit_count = hit_count + 1
            WHERE id = v_existing_alert_id;
        ELSE
            -- Jika belum ada alert 'new': buat baris baru
            INSERT INTO public.crisis_alerts (
                source,
                booking_id,
                ticket_id,
                patient_id,
                detected_by,
                reporter_id,
                category,
                snippet,
                hit_count,
                status,
                created_at
            ) VALUES (
                v_source,
                v_booking_id,
                v_ticket_id,
                v_patient_id,
                'keyword',
                NULL,
                'self_harm_risk',
                v_snippet,
                1,
                'new',
                pg_catalog.now()
            )
            RETURNING id INTO v_alert_id;

            -- 1. Notifikasi ke seluruh admin aktif
            FOR r_admin IN
                SELECT u.id
                FROM public.users u
                WHERE u.role = 'admin'::public.user_role
                  AND u.status = 'active'::public.account_status
            LOOP
                PERFORM public.notify_internal(
                    r_admin.id,
                    'crisis_alert',
                    'Peringatan Krisis Pasien',
                    'Terdeteksi indikasi krisis keselamatan diri pasien yang membutuhkan penanganan segera.',
                    '/admin/crisis-feed'
                );
            END LOOP;

            -- 2. Notifikasi ke pendamping sesi (tanpa snippet)
            IF v_companion_id IS NOT NULL THEN
                PERFORM public.notify_internal(
                    v_companion_id,
                    'crisis_companion_alert',
                    'Peringatan Keselamatan Pasien',
                    'Pasien Anda mungkin membutuhkan perhatian dan pendampingan khusus saat ini. Utamakan keselamatan dan dengarkan dengan penuh empati.',
                    CASE
                        WHEN v_source = 'booking' THEN '/counselor/room?booking=' || v_booking_id::text
                        ELSE '/listener/room/' || v_ticket_id::text
                    END
                );
            END IF;

            -- 3. Notifikasi ke pasien (berisi info hotline 119 ext 8 & 112)
            PERFORM public.notify_internal(
                v_patient_id,
                'crisis_support',
                'Bantuan Selalu Ada Untukmu',
                'Kamu tidak sendirian. Jika butuh bantuan segera, hubungi hotline darurat 119 ext 8 (Pencegahan Bunuh Diri) atau 112 (Panggilan Darurat). Kami peduli padamu.',
                NULL
            );
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            -- Non-blocking fail-safe: cegah kesalahan deteksi membatalkan pesan chat
            NULL;
    END;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_detect_crisis_keyword() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_detect_crisis_keyword() TO service_role;

COMMENT ON FUNCTION public.trg_detect_crisis_keyword() IS 'Trigger fail-safe deteksi kata kunci krisis keselamatan pasien pada session_messages dan peer_messages';

DROP TRIGGER IF EXISTS trg_session_messages_crisis ON public.session_messages;
CREATE TRIGGER trg_session_messages_crisis
    AFTER INSERT ON public.session_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_detect_crisis_keyword();

DROP TRIGGER IF EXISTS trg_peer_messages_crisis ON public.peer_messages;
CREATE TRIGGER trg_peer_messages_crisis
    AFTER INSERT ON public.peer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_detect_crisis_keyword();
