-- ========================================================
-- TEMAN BICARA: HARDENING ANONIMITAS PEER (PRD-048 / T-205)
-- Migration: 20261112000032_peer_anonymity_hardening.sql
-- ========================================================

-- 1. TAMBAH KOLOM SENDER_ROLE PADA PUBLIC.PEER_MESSAGES
ALTER TABLE public.peer_messages
    ADD COLUMN IF NOT EXISTS sender_role text NULL;

-- 2. BACKFILL SENDER_ROLE DARI PUBLIC.PEER_TICKETS
UPDATE public.peer_messages m
SET sender_role = CASE
    WHEN m.sender_id = t.patient_id THEN 'patient'
    WHEN m.sender_id = t.claimed_by THEN 'relawan'
    ELSE NULL
END
FROM public.peer_tickets t
WHERE t.id = m.ticket_id AND m.sender_role IS NULL;

-- Validasi tidak ada baris tanpa sender_role valid
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.peer_messages WHERE sender_role IS NULL) THEN
        RAISE EXCEPTION 'Backfill sender_role failed: orphan or invalid sender found in public.peer_messages';
    END IF;
END $$;

-- Set NOT NULL dan CHECK constraint
ALTER TABLE public.peer_messages
    ALTER COLUMN sender_role SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_peer_messages_sender_role'
          AND conrelid = 'public.peer_messages'::regclass
    ) THEN
        ALTER TABLE public.peer_messages
            ADD CONSTRAINT chk_peer_messages_sender_role
            CHECK (sender_role IN ('patient', 'relawan'));
    END IF;
END $$;

COMMENT ON COLUMN public.peer_messages.sender_role IS 'Peran pengirim pesan: patient atau relawan';

-- 3. TRIGGER BEFORE INSERT: PENGISI OTOMATIS SENDER_ROLE & GUARD PENGIRIM
CREATE OR REPLACE FUNCTION public.peer_messages_set_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
    v_claimed_by UUID;
BEGIN
    SELECT patient_id, claimed_by
    INTO v_patient_id, v_claimed_by
    FROM public.peer_tickets
    WHERE id = NEW.ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SENDER' USING ERRCODE = 'P0002';
    END IF;

    IF NEW.sender_id = v_patient_id THEN
        NEW.sender_role := 'patient';
    ELSIF NEW.sender_id = v_claimed_by THEN
        NEW.sender_role := 'relawan';
    ELSE
        RAISE EXCEPTION 'INVALID_SENDER' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_messages_set_sender_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_messages_set_sender_role() TO service_role;

COMMENT ON FUNCTION public.peer_messages_set_sender_role() IS 'Trigger BEFORE INSERT untuk mengisi sender_role dan menolak pengirim asing pada peer_messages';

DROP TRIGGER IF EXISTS trg_peer_messages_set_sender_role ON public.peer_messages;
CREATE TRIGGER trg_peer_messages_set_sender_role
    BEFORE INSERT ON public.peer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.peer_messages_set_sender_role();

-- 4. HARDENING GRANT SELECT: CABUT TABEL PENUH & GRANT PER-KOLOM
-- Sembunyikan sender_id dari peer_messages, patient_id dari peer_reviews, dan patient_id dari tips untuk authenticated

-- Cabut SELECT tingkat tabel dari authenticated
REVOKE SELECT ON public.peer_messages FROM authenticated;
REVOKE SELECT ON public.peer_reviews FROM authenticated;
REVOKE SELECT ON public.tips FROM authenticated;

-- Bersihkan grant kolom sensitif jika sebelumnya pernah ada
REVOKE SELECT (sender_id) ON public.peer_messages FROM authenticated;
REVOKE SELECT (patient_id) ON public.peer_reviews FROM authenticated;
REVOKE SELECT (patient_id) ON public.tips FROM authenticated;

-- Grant SELECT per-kolom (seluruh kolom KECUALI sender_id)
GRANT SELECT (
    id, ticket_id, kind, body, media_path, duration_seconds, created_at, sender_role
) ON public.peer_messages TO authenticated;

-- Grant SELECT per-kolom (seluruh kolom KECUALI patient_id)
GRANT SELECT (
    ticket_id, relawan_id, rating, review, is_hidden, created_at, updated_at
) ON public.peer_reviews TO authenticated;

-- Grant SELECT per-kolom (seluruh kolom KECUALI patient_id)
GRANT SELECT (
    id, mitra_id, coins, mitra_share_bps, source_type, source_id, created_at
) ON public.tips TO authenticated;

-- Pertahankan akses penuh untuk service_role
GRANT ALL ON public.peer_messages TO service_role;
GRANT ALL ON public.peer_reviews TO service_role;
GRANT ALL ON public.tips TO service_role;
