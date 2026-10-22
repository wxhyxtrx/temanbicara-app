-- ========================================================
-- TEMAN BICARA: TABEL PEER_MESSAGES, REALTIME & RLS (PRD-012)
-- Migration: 20261022000022_peer_messages.sql
-- ========================================================

-- 1. TABEL PEER_MESSAGES
CREATE TABLE IF NOT EXISTS public.peer_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice')),
    body TEXT NULL CHECK (body IS NULL OR pg_catalog.char_length(body) <= 4000),
    media_path TEXT NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_peer_messages_content CHECK (
        (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
        (kind IN ('image', 'voice') AND media_path IS NOT NULL)
    )
);

COMMENT ON TABLE public.peer_messages IS 'Pesan teks, gambar, dan rekaman suara sesi Ruang Dengar sebaya';
COMMENT ON COLUMN public.peer_messages.id IS 'Primary key UUID pesan';
COMMENT ON COLUMN public.peer_messages.ticket_id IS 'ID tiket curhat sebaya terkait';
COMMENT ON COLUMN public.peer_messages.sender_id IS 'ID pengguna pengirim pesan (pasien atau relawan)';
COMMENT ON COLUMN public.peer_messages.kind IS 'Jenis konten pesan: text, image, atau voice';
COMMENT ON COLUMN public.peer_messages.body IS 'Isi pesan teks atau caption (maksimal 4000 karakter)';
COMMENT ON COLUMN public.peer_messages.media_path IS 'Path berkas di private bucket storage session-media';
COMMENT ON COLUMN public.peer_messages.duration_seconds IS 'Durasi rekaman suara dalam detik (khusus pesan suara)';
COMMENT ON COLUMN public.peer_messages.created_at IS 'Waktu pesan dibuat';

-- 2. INDEX PENCARIAN & REALTIME
CREATE INDEX IF NOT EXISTS idx_peer_messages_ticket_created
    ON public.peer_messages (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_peer_messages_sender_id
    ON public.peer_messages (sender_id);

-- 3. PUBLIKASI SUPABASE REALTIME (IDEMPOTEN)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.peer_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 4. ROW LEVEL SECURITY (RLS) & HAK AKSES

-- Perbaikan Policy SELECT pada public.peer_tickets agar relawan pengklaim dapat membaca tiket terkait
-- Dibutuhkan agar subquery RLS pada peer_messages dapat mengevaluasi relawan secara transparan.
DROP POLICY IF EXISTS peer_tickets_select_policy ON public.peer_tickets;
CREATE POLICY peer_tickets_select_policy ON public.peer_tickets
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id
        OR auth.uid() = claimed_by
        OR public.is_admin()
    );

ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Hanya peserta tiket terkait (patient_id atau claimed_by) atau admin
DROP POLICY IF EXISTS peer_messages_select_participant ON public.peer_messages;
CREATE POLICY peer_messages_select_participant ON public.peer_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.peer_tickets t
            WHERE t.id = peer_messages.ticket_id
              AND (t.patient_id = auth.uid() OR t.claimed_by = auth.uid())
        )
        OR public.is_admin()
    );

-- Policy INSERT: Peserta tiket (sender_id = auth.uid()) atau admin
DROP POLICY IF EXISTS peer_messages_insert_participant ON public.peer_messages;
CREATE POLICY peer_messages_insert_participant ON public.peer_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        (
            auth.uid() = sender_id
            AND EXISTS (
                SELECT 1 FROM public.peer_tickets t
                WHERE t.id = peer_messages.ticket_id
                  AND (t.patient_id = auth.uid() OR t.claimed_by = auth.uid())
            )
        )
        OR public.is_admin()
    );

-- Cabut akses UPDATE dan DELETE dari anon dan authenticated demi audit trail percakapan
REVOKE ALL ON public.peer_messages FROM PUBLIC, anon;
REVOKE UPDATE, DELETE ON public.peer_messages FROM authenticated;
GRANT SELECT, INSERT ON public.peer_messages TO authenticated;
GRANT ALL ON public.peer_messages TO service_role;
