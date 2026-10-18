-- ========================================================
-- TEMAN BICARA: SISTEM NOTIFIKASI IN-APP (FASE 3 - TASK B9)
-- Migration: 20261017000018_notifications.sql
-- ========================================================

-- 1. TABEL NOTIFICATIONS
-- Menyimpan record notifikasi in-app untuk pengguna (pasien, psikolog, admin)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.notifications IS 'Tabel notifikasi in-app untuk pengguna (pasien, psikolog, admin)';
COMMENT ON COLUMN public.notifications.id IS 'Primary key UUID notifikasi';
COMMENT ON COLUMN public.notifications.user_id IS 'ID pengguna penerima notifikasi';
COMMENT ON COLUMN public.notifications.type IS 'Tipe event notifikasi (booking_new, booking_cancelled, session_reminder_10, dsb)';
COMMENT ON COLUMN public.notifications.title IS 'Judul ringkas notifikasi';
COMMENT ON COLUMN public.notifications.body IS 'Isi pesan notifikasi (bebas nama pribadi jika penerima psikolog)';
COMMENT ON COLUMN public.notifications.link IS 'Tautan navigasi frontend terkait notifikasi';
COMMENT ON COLUMN public.notifications.read_at IS 'Waktu saat pengguna menandai notifikasi telah dibaca';
COMMENT ON COLUMN public.notifications.created_at IS 'Waktu pembuatan notifikasi';

-- Indeks performa query notifikasi pengguna
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications(user_id)
    WHERE read_at IS NULL;

-- RLS: Pengguna terautentikasi hanya dapat membaca (SELECT) notifikasi miliknya sendiri.
-- Seluruh mutasi tulis (INSERT, UPDATE, DELETE) dicabut dari anon & authenticated.
-- Route API menggunakan service_role dengan penyaringan eksplisit user_id.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_policy ON public.notifications;
CREATE POLICY notifications_select_policy ON public.notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;


-- 2. PUBLIKASI REALTIME
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;


-- 3. FUNGSI INTERNAL PEMBUATAN NOTIFIKASI (SECURITY DEFINER)
-- Hanya dapat dieksekusi oleh service_role atau fungsi trigger backend internal
CREATE OR REPLACE FUNCTION public.notify_internal(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        link,
        created_at
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_body,
        p_link,
        pg_catalog.now()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_internal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_internal(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.notify_internal(UUID, TEXT, TEXT, TEXT, TEXT) IS 'Fungsi internal pembentukan record notifikasi dengan hak akses service_role / trigger';


-- 4. KOLOM PENGINGAT PADA TABEL BOOKINGS
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS reminded_60_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS reminded_10_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.bookings.reminded_60_at IS 'Waktu pengiriman pengingat sesi 60 menit';
COMMENT ON COLUMN public.bookings.reminded_10_at IS 'Waktu pengiriman pengingat sesi 10 menit';

-- Reset status pengingat jika start_at dijadwal ulang (reschedule)
CREATE OR REPLACE FUNCTION public.trg_bookings_reset_reminders_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.start_at IS DISTINCT FROM NEW.start_at THEN
        NEW.reminded_60_at := NULL;
        NEW.reminded_10_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_reset_reminders ON public.bookings;
CREATE TRIGGER trg_bookings_reset_reminders
    BEFORE UPDATE OF start_at ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_bookings_reset_reminders_before_update();


-- 5. TRIGGER NOTIFIKASI PADA BOOKINGS
-- Trigger INSERT: Booking baru diterima -> notifikasi ke psikolog
CREATE OR REPLACE FUNCTION public.trg_bookings_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.notify_internal(
        NEW.psikolog_id,
        'booking_new',
        'Booking Baru Masuk',
        'Pasien ' || NEW.patient_display_name || ' telah memesan sesi konseling.',
        '/counselor/schedule'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_notify_insert ON public.bookings;
CREATE TRIGGER trg_bookings_notify_insert
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_bookings_notify_after_insert();

-- Trigger UPDATE: Perubahan status, reschedule start_at, atau status perpanjangan (extension)
CREATE OR REPLACE FUNCTION public.trg_bookings_notify_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- A. Notifikasi perubahan status booking
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- 1. Pasien membatalkan booking -> psikolog diberi tahu
        IF NEW.status = 'cancelled_by_patient' THEN
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'booking_cancelled',
                'Booking Dibatalkan Pasien',
                'Pasien ' || NEW.patient_display_name || ' membatalkan jadwal sesi konseling.',
                '/counselor/schedule'
            );
        -- 2. Psikolog membatalkan booking -> pasien diberi tahu untuk memilih jadwal/refund
        ELSIF NEW.status = 'awaiting_patient_choice' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'psikolog_cancelled_choice',
                'Jadwal Konseling Dibatalkan Psikolog',
                'Psikolog berhalangan hadir. Silakan pilih jadwal pengganti atau pengembalian koin penuh 100%.',
                '/patient/schedule'
            );
        -- 3. Sesi konseling dimulai (in_progress) -> kedua belah pihak
        ELSIF NEW.status = 'in_progress' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'session_started',
                'Sesi Konseling Dimulai',
                'Sesi konseling Anda telah dimulai. Silakan masuk ke ruang konsultasi.',
                '/room/' || NEW.id
            );
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'session_started',
                'Sesi Konseling Dimulai',
                'Sesi konseling bersama ' || NEW.patient_display_name || ' telah dimulai. Silakan masuk ke ruang konsultasi.',
                '/counselor/room/' || NEW.id
            );
        -- 4. Sesi selesai (completed)
        ELSIF NEW.status = 'completed' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'completed',
                'Sesi Konseling Selesai',
                'Sesi konseling telah selesai. Anda dapat memberikan penilaian dan ulasan.',
                '/patient/schedule'
            );
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'completed',
                'Sesi Konseling Selesai',
                'Sesi konseling bersama ' || NEW.patient_display_name || ' telah selesai.',
                '/counselor/schedule'
            );
        -- 5. Auto cancelled late (psikolog terlambat hadir)
        ELSIF NEW.status = 'auto_cancelled_late' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'auto_cancelled_late',
                'Sesi Konseling Dibatalkan Otomatis',
                'Sesi konseling dibatalkan otomatis karena psikolog tidak hadir. Koin Anda telah dikembalikan penuh 100%.',
                '/patient/schedule'
            );
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'auto_cancelled_late',
                'Sesi Konseling Dibatalkan Otomatis',
                'Sesi konseling bersama ' || NEW.patient_display_name || ' dibatalkan otomatis karena keterlambatan hadir.',
                '/counselor/schedule'
            );
        -- 6. Pasien no-show
        ELSIF NEW.status = 'no_show' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'no_show',
                'Sesi Konseling Berakhir (No Show)',
                'Sesi konseling ditutup karena Anda tidak hadir dalam batas waktu sapaan.',
                '/patient/schedule'
            );
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'no_show',
                'Sesi Konseling Berakhir (No Show)',
                'Sesi konseling ditutup karena pasien ' || NEW.patient_display_name || ' tidak hadir.',
                '/counselor/schedule'
            );
        END IF;
    END IF;

    -- B. Reschedule: start_at berubah -> notifikasi ke psikolog
    IF OLD.start_at IS DISTINCT FROM NEW.start_at THEN
        PERFORM public.notify_internal(
            NEW.psikolog_id,
            'reschedule',
            'Jadwal Konseling Diubah',
            'Pasien ' || NEW.patient_display_name || ' telah memindahkan jadwal sesi konseling.',
            '/counselor/schedule'
        );
    END IF;

    -- C. Status perpanjangan sesi (extension_status)
    IF OLD.extension_status IS DISTINCT FROM NEW.extension_status THEN
        -- Pasien mengajukan ekstensi -> notifikasi ke psikolog
        IF NEW.extension_status = 'requested' THEN
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'extension_requested',
                'Permintaan Perpanjangan Sesi',
                'Pasien ' || NEW.patient_display_name || ' mengajukan perpanjangan waktu sesi (+10 menit).',
                '/counselor/room/' || NEW.id
            );
        -- Psikolog menyetujui ekstensi -> notifikasi ke pasien
        ELSIF NEW.extension_status = 'approved' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'extension_approved',
                'Perpanjangan Sesi Disetujui',
                'Psikolog telah menyetujui perpanjangan waktu sesi (+10 menit).',
                '/room/' || NEW.id
            );
        -- Psikolog menolak ekstensi -> notifikasi ke pasien
        ELSIF NEW.extension_status = 'declined' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'extension_declined',
                'Perpanjangan Sesi Ditolak',
                'Psikolog belum dapat memperpanjang sesi kali ini.',
                '/room/' || NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_notify_update ON public.bookings;
CREATE TRIGGER trg_bookings_notify_update
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_bookings_notify_after_update();


-- 6. TRIGGER NOTIFIKASI PADA TIPS
-- Pasien memberikan tip sesi konseling -> notifikasi ke psikolog (pasien anonim, tanpa nama)
CREATE OR REPLACE FUNCTION public.trg_tips_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.source_type = 'session' THEN
        PERFORM public.notify_internal(
            NEW.mitra_id,
            'tip_received',
            'Tip Sesi Konseling Diterima',
            'Anda menerima tip sebesar ' || NEW.coins::text || ' koin atas sesi konseling.',
            '/counselor/schedule'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tips_notify_insert ON public.tips;
CREATE TRIGGER trg_tips_notify_insert
    AFTER INSERT ON public.tips
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_tips_notify_after_insert();


-- 7. TRIGGER NOTIFIKASI PADA PSIKOLOG_STRIKES & SUSPENSI
-- Poin strike bertambah -> notifikasi ke psikolog
CREATE OR REPLACE FUNCTION public.trg_strikes_notify_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.notify_internal(
        NEW.psikolog_id,
        'strike_added',
        'Poin Penalti Ditambahkan',
        'Anda menerima ' || NEW.points::text || ' poin penalti (strike) karena ' ||
        (CASE WHEN NEW.reason = 'late_cancel' THEN 'pembatalan terlambat' ELSE 'tidak hadir di sesi' END) || '.',
        '/counselor/schedule'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_strikes_notify_insert ON public.psikolog_strikes;
CREATE TRIGGER trg_strikes_notify_insert
    AFTER INSERT ON public.psikolog_strikes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_strikes_notify_after_insert();

-- Akun ditangguhkan (suspended_until diperbarui dan > now()) -> notifikasi ke psikolog
CREATE OR REPLACE FUNCTION public.trg_psikolog_profiles_notify_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.suspended_until IS DISTINCT FROM NEW.suspended_until THEN
        IF NEW.suspended_until IS NOT NULL AND NEW.suspended_until > pg_catalog.now() THEN
            PERFORM public.notify_internal(
                NEW.user_id,
                'suspended',
                'Akun Psikolog Ditangguhkan',
                'Akun Anda ditangguhkan sementara akibat akumulasi poin penalti (strike) hingga ' ||
                pg_catalog.to_char(NEW.suspended_until AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') || ' WIB.',
                '/counselor/schedule'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psikolog_profiles_notify_update ON public.psikolog_profiles;
CREATE TRIGGER trg_psikolog_profiles_notify_update
    AFTER UPDATE OF suspended_until ON public.psikolog_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_psikolog_profiles_notify_after_update();


-- 8. PEMBARUAN FUNGSI SESSION_TICK (DENGAN LOOP PENGINGAT 60 & 10 MENIT + RESILIENCE)
CREATE OR REPLACE FUNCTION public.session_tick()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_psikolog_late_minutes INTEGER := 10;
    v_patient_noshow_minutes INTEGER := 30;
    v_booking RECORD;
BEGIN
    SELECT COALESCE((value->>'minutes')::INTEGER, 10)
    INTO v_psikolog_late_minutes
    FROM public.system_settings
    WHERE key = 'psikolog_late';
    v_psikolog_late_minutes := COALESCE(v_psikolog_late_minutes, 10);

    SELECT COALESCE((value->>'minutes')::INTEGER, 30)
    INTO v_patient_noshow_minutes
    FROM public.system_settings
    WHERE key = 'patient_noshow';
    v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

    -- PENGINGAT 1: Jendela H-60 menit (dimulai dari H-60 menit hingga H-10 menit sebelum start_at)
    FOR v_booking IN
        SELECT id, patient_id, psikolog_id, start_at, patient_display_name
        FROM public.bookings
        WHERE status = 'booked'
          AND reminded_60_at IS NULL
          AND pg_catalog.now() >= start_at - INTERVAL '60 minutes'
          AND pg_catalog.now() < start_at - INTERVAL '10 minutes'
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            UPDATE public.bookings
            SET reminded_60_at = pg_catalog.now(),
                updated_at = pg_catalog.now()
            WHERE id = v_booking.id;

            -- Notifikasi ke pasien
            PERFORM public.notify_internal(
                v_booking.patient_id,
                'session_reminder_60',
                'Pengingat Sesi Konseling (1 Jam Lagi)',
                'Sesi konseling Anda akan dimulai dalam 1 jam (pukul ' || pg_catalog.to_char(v_booking.start_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB). Mohon bersiap.',
                '/patient/schedule'
            );

            -- Notifikasi ke psikolog (hanya patient_display_name)
            PERFORM public.notify_internal(
                v_booking.psikolog_id,
                'session_reminder_60',
                'Pengingat Sesi Konseling (1 Jam Lagi)',
                'Sesi konseling bersama pasien ' || v_booking.patient_display_name || ' akan dimulai dalam 1 jam (pukul ' || pg_catalog.to_char(v_booking.start_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB).',
                '/counselor/schedule'
            );

            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on reminder_60 for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- PENGINGAT 2: Jendela H-10 menit (dimulai dari H-10 menit sebelum start_at)
    FOR v_booking IN
        SELECT id, patient_id, psikolog_id, start_at, patient_display_name
        FROM public.bookings
        WHERE status = 'booked'
          AND reminded_10_at IS NULL
          AND pg_catalog.now() >= start_at - INTERVAL '10 minutes'
          AND pg_catalog.now() < start_at + (v_psikolog_late_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            UPDATE public.bookings
            SET reminded_10_at = pg_catalog.now(),
                reminded_60_at = COALESCE(reminded_60_at, pg_catalog.now()),
                updated_at = pg_catalog.now()
            WHERE id = v_booking.id;

            -- Notifikasi ke pasien
            PERFORM public.notify_internal(
                v_booking.patient_id,
                'session_reminder_10',
                'Pengingat Sesi Konseling (10 Menit Lagi)',
                'Sesi konseling Anda akan dimulai dalam 10 menit. Silakan bersiap masuk ke ruang konsultasi.',
                '/patient/schedule'
            );

            -- Notifikasi ke psikolog (hanya patient_display_name)
            PERFORM public.notify_internal(
                v_booking.psikolog_id,
                'session_reminder_10',
                'Pengingat Sesi Konseling (10 Menit Lagi)',
                'Sesi konseling bersama pasien ' || v_booking.patient_display_name || ' akan dimulai dalam 10 menit. Mohon bersiap menyapa pasien.',
                '/counselor/schedule'
            );

            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on reminder_10 for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 1. Psikolog telat / tidak menyapa: booked & tanpa pesan psikolog > start_at + psikolog_late
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'booked'
          AND psikolog_first_msg_at IS NULL
          AND pg_catalog.now() > start_at + (v_psikolog_late_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'auto_cancelled_late');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on auto_cancelled_late for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 2. Pasien no-show: in_progress & psikolog sudah menyapa tapi pasien belum menyapa > psikolog_first_msg_at + patient_noshow
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND psikolog_first_msg_at IS NOT NULL
          AND patient_first_msg_at IS NULL
          AND pg_catalog.now() > psikolog_first_msg_at + (v_patient_noshow_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'no_show');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on no_show for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 3. Hard cap 58 menit: in_progress & waktu sudah mencapai start_at + 58 menit
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND pg_catalog.now() >= start_at + INTERVAL '58 minutes'
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_settle_internal(v_booking.id, 'completed');
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on completed for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 4. Batas pilihan pasien lewat: awaiting_patient_choice & choice_deadline_at lewat
    FOR v_booking IN
        SELECT id, patient_id
        FROM public.bookings
        WHERE status = 'awaiting_patient_choice'
          AND choice_deadline_at IS NOT NULL
          AND pg_catalog.now() > choice_deadline_at
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            PERFORM public.booking_choose_refund(v_booking.id, v_booking.patient_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on choice_deadline for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.session_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_tick() TO service_role;

COMMENT ON FUNCTION public.session_tick() IS 'Timer periodic pemrosesan transisi siklus sesi konseling, pengingat 60/10 menit, dan settlement otomatis';
