-- ========================================================
-- TEMAN BICARA: PURGE MEDIA SESI KADALUWARSA (FASE 3 - TASK B10)
-- Migration: 20261017000019_purge_media.sql
-- ========================================================

-- 1. FUNGSI RPC: session_media_mark_purged
-- Mengubah pesan media yang berkasnya telah dihapus dari bucket 'session-media'
-- Menyesuaikan kind='text', body='[media dihapus]', media_path=NULL, duration_seconds=NULL
-- Mematuhi constraint chk_session_message_content:
--   (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
--   (kind IN ('image', 'voice') AND media_path IS NOT NULL)
CREATE OR REPLACE FUNCTION public.session_media_mark_purged(p_message_ids uuid[])
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

    UPDATE public.session_messages
    SET kind = 'text',
        body = '[media dihapus]',
        media_path = NULL,
        duration_seconds = NULL
    WHERE id = ANY(p_message_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.session_media_mark_purged(uuid[]) IS 'Menandai pesan sesi sebagai terhapus medianya setelah berkas fisik dihapus dari storage';

-- 2. HAK AKSES FUNGSI (SECURITY DEFINER)
REVOKE ALL ON FUNCTION public.session_media_mark_purged(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_media_mark_purged(uuid[]) TO service_role;
