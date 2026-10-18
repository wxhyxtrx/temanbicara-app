-- ========================================================
-- TEMAN BICARA: CATATAN KLIEN & EMERGENCY CONTACT ACCESS LOG (FASE 3 - TASK B7)
-- Migration: 20261017000016_client_notes.sql
-- ========================================================

-- 1. TABEL CLIENT_NOTES
-- Catatan klinis sesi konseling yang ditulis oleh psikolog pemeriksa.
-- Akses dibatasi secara ketat hanya untuk psikolog penulis catatan tersebut.
CREATE TABLE IF NOT EXISTS public.client_notes (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    psikolog_id UUID NOT NULL REFERENCES public.users(id),
    patient_id UUID NOT NULL REFERENCES public.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT client_notes_body_len_check CHECK (pg_catalog.length(body) <= 5000)
);

COMMENT ON TABLE public.client_notes IS 'Catatan klinis per sesi yang ditulis oleh psikolog pemeriksa (sangat rahasia, hanya psikolog penulis yang dapat mengakses)';
COMMENT ON COLUMN public.client_notes.booking_id IS 'ID sesi konseling terkait (1 catatan per booking)';
COMMENT ON COLUMN public.client_notes.psikolog_id IS 'ID psikolog penulis catatan klinis';
COMMENT ON COLUMN public.client_notes.patient_id IS 'ID pasien subjek sesi konseling';
COMMENT ON COLUMN public.client_notes.body IS 'Isi catatan klinis bebas (maksimal 5000 karakter)';

-- Indexes untuk pencarian riwayat catatan per pasien & psikolog
CREATE INDEX IF NOT EXISTS idx_client_notes_psikolog_patient
    ON public.client_notes(psikolog_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_notes_patient
    ON public.client_notes(patient_id);

CREATE INDEX IF NOT EXISTS idx_client_notes_psikolog
    ON public.client_notes(psikolog_id);

-- RLS client_notes: hanya psikolog penulis yang dapat membaca (tanpa akses admin / pasien)
-- Penulisan (INSERT/UPDATE/DELETE) dibatasi hanya via RPC service_role
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_notes_select_psikolog ON public.client_notes;
CREATE POLICY client_notes_select_psikolog ON public.client_notes
    FOR SELECT TO authenticated
    USING (auth.uid() = psikolog_id);

REVOKE INSERT, UPDATE, DELETE ON public.client_notes FROM anon, authenticated;


-- 2. TABEL EMERGENCY_CONTACT_ACCESS_LOG
-- Log audit akses kontak darurat pasien oleh admin dalam situasi krisis klinis.
CREATE TABLE IF NOT EXISTS public.emergency_contact_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id),
    patient_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.emergency_contact_access_log IS 'Log audit akses kontak darurat pasien oleh admin untuk kondisi krisis klinis';
COMMENT ON COLUMN public.emergency_contact_access_log.admin_id IS 'ID admin yang membuka data kontak darurat';
COMMENT ON COLUMN public.emergency_contact_access_log.patient_id IS 'ID pasien yang kontak daruratnya diakses';

CREATE INDEX IF NOT EXISTS idx_emergency_contact_log_patient
    ON public.emergency_contact_access_log(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_contact_log_admin
    ON public.emergency_contact_access_log(admin_id, created_at DESC);

-- RLS emergency_contact_access_log: hanya admin aktif yang dapat membaca log (menggunakan public.is_admin())
-- Pencatatan log dilakukan oleh server route via service_role
ALTER TABLE public.emergency_contact_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_contact_log_admin_select ON public.emergency_contact_access_log;
CREATE POLICY emergency_contact_log_admin_select ON public.emergency_contact_access_log
    FOR SELECT TO authenticated
    USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.emergency_contact_access_log FROM anon, authenticated;


-- 3. RPC: client_note_upsert
-- Fungsi atomik untuk membuat atau memperbarui catatan klien oleh psikolog yang bertugas.
-- Syarat: status booking in_progress atau completed, psikolog_id cocok, panjang teks <= 5000.
CREATE OR REPLACE FUNCTION public.client_note_upsert(
    p_booking_id UUID,
    p_psikolog_id UUID,
    p_body TEXT
)
RETURNS public.client_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_note public.client_notes%ROWTYPE;
    v_trimmed TEXT;
BEGIN
    -- 1. Validasi keberadaan booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Validasi kepemilikan sesi konseling
    IF v_booking.psikolog_id <> p_psikolog_id THEN
        RAISE EXCEPTION 'FORBIDDEN_NOT_BOOKING_PSIKOLOG' USING ERRCODE = '42501';
    END IF;

    -- 3. Validasi status booking (hanya in_progress atau completed)
    IF v_booking.status NOT IN ('in_progress', 'completed') THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Validasi panjang body catatan
    v_trimmed := pg_catalog.btrim(COALESCE(p_body, ''));
    IF pg_catalog.length(v_trimmed) > 5000 THEN
        RAISE EXCEPTION 'BODY_TOO_LONG' USING ERRCODE = 'P0001';
    END IF;

    -- 5. Upsert catatan
    INSERT INTO public.client_notes (
        booking_id,
        psikolog_id,
        patient_id,
        body,
        created_at,
        updated_at
    )
    VALUES (
        v_booking.id,
        v_booking.psikolog_id,
        v_booking.patient_id,
        v_trimmed,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (booking_id) DO UPDATE
    SET body = EXCLUDED.body,
        updated_at = pg_catalog.now()
    RETURNING * INTO v_note;

    RETURN v_note;
END;
$$;

-- Hak eksekusi: hanya service_role, dicabut dari publik/anon/authenticated
REVOKE ALL ON FUNCTION public.client_note_upsert(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_note_upsert(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.client_note_upsert(UUID, UUID, TEXT)
    IS 'Membuat atau memperbarui catatan klinis sesi konseling oleh psikolog yang bertugas (in_progress/completed)';
