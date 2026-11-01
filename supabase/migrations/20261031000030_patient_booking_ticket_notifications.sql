-- ========================================================
-- TEMAN BICARA: TRIGGER NOTIFIKASI IN-APP PASIEN (PRD-030)
-- Migration: 20261031000030_patient_booking_ticket_notifications.sql
-- ========================================================

-- 1. TRIGGER NOTIFIKASI BOOKING KONSELING DIKONFIRMASI (PUBLIC.BOOKINGS)
-- Mengirim notifikasi in-app ke pasien saat booking konseling berhasil dibuat (INSERT)
-- dengan status booked/confirmed, mencantumkan nama psikolog dan jumlah koin
-- yang terpotong serta link ke /patient/schedule.
CREATE OR REPLACE FUNCTION public.trg_bookings_notify_patient_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_psikolog_name TEXT;
BEGIN
    -- Jalankan saat INSERT dengan status 'booked' atau 'confirmed'
    IF TG_OP = 'INSERT' THEN
        IF NEW.status NOT IN ('booked', 'confirmed') THEN
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- Ambil nama psikolog dari profil
    SELECT COALESCE(nama_lengkap_gelar, 'Psikolog')
    INTO v_psikolog_name
    FROM public.psikolog_profiles
    WHERE user_id = NEW.psikolog_id;

    v_psikolog_name := COALESCE(pg_catalog.btrim(v_psikolog_name), '');
    IF v_psikolog_name = '' THEN
        v_psikolog_name := 'Psikolog';
    END IF;

    PERFORM public.notify_internal(
        NEW.patient_id,
        'booking_confirmed',
        'Jadwal Konseling Dikonfirmasi',
        'Sesi konseling bersama ' || v_psikolog_name || ' berhasil dikonfirmasi. ' || NEW.price_coins || ' Koin terpotong.',
        '/patient/schedule'
    );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_bookings_notify_patient_confirmed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_bookings_notify_patient_confirmed() TO service_role;

COMMENT ON FUNCTION public.trg_bookings_notify_patient_confirmed() IS 'Trigger notifikasi in-app ke pasien saat booking konseling dibuat dengan rincian nama psikolog dan koin';

DROP TRIGGER IF EXISTS trg_bookings_notify_patient_confirmed ON public.bookings;
CREATE TRIGGER trg_bookings_notify_patient_confirmed
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_bookings_notify_patient_confirmed();


-- 2. TRIGGER NOTIFIKASI TIKET CURHAT SEBAYA DIBUAT (PUBLIC.PEER_TICKETS)
-- Mengirim notifikasi in-app ke pasien saat tiket curhat sebaya baru dibuat (status = 'open').
-- DILARANG KERAS menyertakan judul keluhan, isi cerita, atau topik/emosi demi privasi medis.
CREATE OR REPLACE FUNCTION public.trg_peer_tickets_notify_patient_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status::TEXT <> 'open' THEN
        RETURN NEW;
    END IF;

    PERFORM public.notify_internal(
        NEW.patient_id,
        'peer_ticket_created',
        'Tiket Curhat Dibuat',
        'Tiket curhat Anda telah berhasil dibuat. Sistem sedang mencarikan pendengar sebaya untukmu.',
        '/patient/curhat'
    );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_peer_tickets_notify_patient_created() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_peer_tickets_notify_patient_created() TO service_role;

COMMENT ON FUNCTION public.trg_peer_tickets_notify_patient_created() IS 'Trigger notifikasi in-app ke pasien saat tiket curhat sebaya dibuat tanpa membeberkan isi cerita';

DROP TRIGGER IF EXISTS trg_peer_tickets_notify_patient_created ON public.peer_tickets;
CREATE TRIGGER trg_peer_tickets_notify_patient_created
    AFTER INSERT ON public.peer_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tickets_notify_patient_created();
