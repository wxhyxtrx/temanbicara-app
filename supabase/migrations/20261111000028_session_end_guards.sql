-- ========================================================
-- TEMAN BICARA: GUARDS WAKTU & NO-SHOW PADA SESSION_END (PRD-046 / T-193)
-- Migration: 20261111000028_session_end_guards.sql
-- ========================================================

-- Redefinisi public.session_end:
-- Menambahkan guard validasi waktu mulai (pg_catalog.now() >= start_at)
-- dan batas waktu no-show pasien (psychologist_first_msg_at + patient_noshow)
-- sebelum mengakhiri sesi dan menjalankan booking_settle_internal.
CREATE OR REPLACE FUNCTION public.session_end(
    p_booking_id UUID,
    p_psikolog_id UUID
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_patient_noshow_minutes INTEGER := 30;
BEGIN
    IF p_booking_id IS NULL OR p_psikolog_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.psikolog_id <> p_psikolog_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    -- Idempoten jika sudah selesai
    IF v_booking.status = 'completed' THEN
        RETURN v_booking;
    END IF;

    IF v_booking.status <> 'in_progress' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    -- Guard 1: Tolak jika waktu sekarang belum mencapai start_at
    IF pg_catalog.now() < v_booking.start_at THEN
        RAISE EXCEPTION 'SESSION_NOT_STARTED: Sesi belum dimulai.' USING ERRCODE = 'P0001';
    END IF;

    -- Guard 2: Jika pasien belum membalas pesan, tolak hingga batas patient_noshow terlewati
    IF v_booking.patient_first_msg_at IS NULL THEN
        SELECT COALESCE((value->>'minutes')::INTEGER, 30)
        INTO v_patient_noshow_minutes
        FROM public.system_settings
        WHERE key = 'patient_noshow';
        v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

        IF v_booking.psikolog_first_msg_at IS NULL OR
           pg_catalog.now() < v_booking.psikolog_first_msg_at + (v_patient_noshow_minutes * INTERVAL '1 minute') THEN
            RAISE EXCEPTION 'PATIENT_NO_SHOW_PENDING: Pasien belum membalas pesan dan batas waktu no-show belum terlewati.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Update status menjadi completed
    UPDATE public.bookings
    SET status = 'completed',
        ended_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Settle hasil sesi (honor mitra dan revenue platform)
    PERFORM public.booking_settle_internal(p_booking_id, 'completed');

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.session_end(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_end(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.session_end(UUID, UUID) IS 'RPC untuk psikolog mengakhiri sesi konseling dengan guard waktu mulai dan batas no-show pasien';
