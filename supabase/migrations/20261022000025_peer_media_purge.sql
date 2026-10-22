-- ========================================================
-- TEMAN BICARA: PURGE MEDIA SESI SEBAYA / RUANG DENGAR (PRD-018)
-- Migration: 20261022000025_peer_media_purge.sql
-- ========================================================

-- 1. FUNGSI RPC: peer_media_mark_purged
-- Mengubah pesan media peer_messages yang berkas fisiknya telah dihapus dari bucket 'session-media'
-- Menyesuaikan kind='text', body='[media dihapus]', media_path=NULL, duration_seconds=NULL
-- Pengaman internal:
--   - Hanya memperbarui pesan dengan media_path IS NOT NULL
--   - Hanya memperbarui pesan dari peer_tickets yang berstatus 'closed' atau 'archived'
-- Mematuhi constraint chk_peer_messages_content:
--   (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
--   (kind IN ('image', 'voice') AND media_path IS NOT NULL)
CREATE OR REPLACE FUNCTION public.peer_media_mark_purged(p_message_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_updated_count integer := 0;
BEGIN
    IF p_message_ids IS NULL OR pg_catalog.cardinality(p_message_ids) = 0 THEN
        RETURN 0;
    END IF;

    UPDATE public.peer_messages m
    SET kind = 'text',
        body = '[media dihapus]',
        media_path = NULL,
        duration_seconds = NULL
    FROM public.peer_tickets t
    WHERE m.id = ANY(p_message_ids)
      AND m.ticket_id = t.id
      AND m.media_path IS NOT NULL
      AND t.status IN ('closed', 'archived');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.peer_media_mark_purged(uuid[]) IS 'Menandai pesan curhat sebaya sebagai terhapus medianya setelah berkas fisik dihapus dari storage';

-- 2. HAK AKSES FUNGSI (SECURITY DEFINER)
REVOKE ALL ON FUNCTION public.peer_media_mark_purged(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_media_mark_purged(uuid[]) TO service_role;
