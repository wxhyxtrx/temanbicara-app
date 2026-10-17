-- ========================================================
-- TEMAN BICARA: TABEL SESSION_MESSAGES, REALTIME, & TRIGGER (FASE 3 - TASK B6a)
-- Migration: 20261017000014_session_messages.sql
-- ========================================================

-- 1. TABEL SESSION_MESSAGES
CREATE TABLE IF NOT EXISTS public.session_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice')),
    body TEXT NULL CHECK (body IS NULL OR pg_catalog.char_length(body) <= 4000),
    media_path TEXT NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_session_message_content CHECK (
        (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
        (kind IN ('image', 'voice') AND media_path IS NOT NULL)
    )
);

COMMENT ON TABLE public.session_messages IS 'Pesan teks, gambar, dan rekaman suara sesi konseling';
COMMENT ON COLUMN public.session_messages.booking_id IS 'ID booking sesi terkait';
COMMENT ON COLUMN public.session_messages.sender_id IS 'ID pengguna pengirim pesan (pasien atau psikolog)';
COMMENT ON COLUMN public.session_messages.kind IS 'Jenis konten pesan: text, image, atau voice';
COMMENT ON COLUMN public.session_messages.body IS 'Isi pesan teks atau keterangan/caption (maksimal 4000 karakter)';
COMMENT ON COLUMN public.session_messages.media_path IS 'Path berkas di bucket private storage session-media';
COMMENT ON COLUMN public.session_messages.duration_seconds IS 'Durasi rekaman suara dalam detik (khusus pesan suara)';

-- 2. INDEX PENCARIAN & REALTIME
CREATE INDEX IF NOT EXISTS idx_session_messages_booking_created
    ON public.session_messages (booking_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_session_messages_sender_id
    ON public.session_messages (sender_id);

-- 3. PUBLICATION SUPABASE_REALTIME
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.session_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Hanya peserta booking terkait (auth.uid() = patient_id atau auth.uid() = psikolog_id)
DROP POLICY IF EXISTS session_messages_select_participant ON public.session_messages;
CREATE POLICY session_messages_select_participant ON public.session_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = session_messages.booking_id
              AND (b.patient_id = auth.uid() OR b.psikolog_id = auth.uid())
        )
    );

-- INSERT: Hanya via API (service role membypass RLS, role authenticated tidak memiliki policy INSERT)
DROP POLICY IF EXISTS session_messages_insert_service_only ON public.session_messages;

-- 5. TRIGGER AFTER INSERT: session_message_after_insert
-- Logika:
-- - Isi psikolog_first_msg_at / patient_first_msg_at bila null
-- - Status booked -> in_progress pada pesan pertama psikolog
-- - psikolog_late = true jika pesan pertama psikolog > start_at
-- - Pesan berikutnya dari psikolog/pasien tidak mengubah timestamp atau status
CREATE OR REPLACE FUNCTION public.session_message_after_insert_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_is_late BOOLEAN;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = NEW.booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Bila pengirim adalah psikolog booking ini
    IF NEW.sender_id = v_booking.psikolog_id THEN
        IF v_booking.psikolog_first_msg_at IS NULL THEN
            v_is_late := (NEW.created_at > v_booking.start_at);

            UPDATE public.bookings
            SET psikolog_first_msg_at = NEW.created_at,
                status = CASE WHEN status = 'booked' THEN 'in_progress' ELSE status END,
                psikolog_late = v_is_late,
                updated_at = pg_catalog.now()
            WHERE id = NEW.booking_id;
        END IF;

    -- Bila pengirim adalah pasien booking ini
    ELSIF NEW.sender_id = v_booking.patient_id THEN
        IF v_booking.patient_first_msg_at IS NULL THEN
            UPDATE public.bookings
            SET patient_first_msg_at = NEW.created_at,
                updated_at = pg_catalog.now()
            WHERE id = NEW.booking_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_message_after_insert ON public.session_messages;
CREATE TRIGGER trg_session_message_after_insert
    AFTER INSERT ON public.session_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.session_message_after_insert_fn();

-- 6. REGISTRASI STORAGE BUCKET 'session-media' (PRIVATE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'session-media',
    'session-media',
    false,
    10485760, -- 10MB (sesuai upload.chat_media_max_mb)
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'audio/webm',
        'audio/ogg',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav',
        'audio/m4a',
        'audio/x-m4a'
    ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
