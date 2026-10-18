-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000018 (NOTIFIKASI IN-APP)
-- Path: supabase/tests/notifications_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 1 pasien, 1 other pasien
-- 2. DDL Salinan persis dari 20261017000018_notifications.sql
-- 3. Assert Uji 1: booking baru -> 1 booking_new psikolog
-- 4. Assert Uji 2: session_tick 2x dalam jendela 10 menit -> tepat 1 session_reminder_10 per peserta (idempoten)
-- 5. Assert Uji 3: batal pasien -> 1 notifikasi booking_cancelled ke psikolog
-- 6. Assert Uji 4: tip -> tip_received tanpa nama pasien (anonim)
-- 7. Assert Uji 5: RLS user lain 0 baris
-- 8. Assert Uji 6: strike_added, suspended, reschedule, dan extension_status
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b9_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b9000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b9_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b9000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b9_other@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b9000000-0000-0000-0000-000000000001', 'b9_psikolog@temanbicara.test', '081299990901', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b9000000-0000-0000-0000-000000000002', 'b9_pasien@temanbicara.test', '081299990902', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b9000000-0000-0000-0000-000000000003', 'b9_other@temanbicara.test', '081299990903', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL
INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url, spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused)
VALUES
    ('b9000000-0000-0000-0000-000000000001', 'Dr. B9 Psikolog, M.Psi', 'SIPP-B9-001', 'https://storage.test/sipp-b9.pdf', ARRAY['Kecemasan'], 5, 150000, false)
ON CONFLICT (user_id) DO UPDATE SET tarif_sesi = EXCLUDED.tarif_sesi, booking_paused = false, suspended_until = NULL;

INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b9000000-0000-0000-0000-000000000002', 'Budi Santoso', 'Budi', 'Ibu Budi', '081100000902', false),
    ('b9000000-0000-0000-0000-000000000003', 'Dewi Lestari', 'Dewi', 'Pak Dewi', '081100000903', false)
ON CONFLICT (user_id) DO NOTHING;

-- 4. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('rating', '{"window_days": 7, "min_count_to_show": 3}'::jsonb),
    ('tip', '{"min_coins": 1, "max_coins": 10, "daily_cap_coins_per_patient": 50}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('strike', '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb),
    ('psikolog_late', '{"minutes": 10}'::jsonb),
    ('patient_noshow', '{"minutes": 30}'::jsonb),
    ('booking', '{"min_hours_before": 1, "max_days_ahead": 14, "max_active_per_patient": 10, "max_per_psikolog_per_day": 10, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. SETUP WALLETS
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('b9000000-0000-0000-0000-000000000001', 0, 0, 0),
    ('b9000000-0000-0000-0000-000000000002', 100, 0, 0),
    ('b9000000-0000-0000-0000-000000000003', 50, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET coin_balance = EXCLUDED.coin_balance;


-- ========================================================
-- SALINAN DDL DARI 20261017000018_notifications.sql
-- ========================================================

-- 1. TABEL NOTIFICATIONS
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications(user_id)
    WHERE read_at IS NULL;

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

-- 3. FUNGSI INTERNAL NOTIFY_INTERNAL
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

-- 4. KOLOM PENGINGAT BOOKINGS
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS reminded_60_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS reminded_10_at TIMESTAMPTZ NULL;

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

-- 5. TRIGGER NOTIFIKASI BOOKINGS
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

CREATE OR REPLACE FUNCTION public.trg_bookings_notify_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- A. Notifikasi perubahan status booking
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'cancelled_by_patient' THEN
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'booking_cancelled',
                'Booking Dibatalkan Pasien',
                'Pasien ' || NEW.patient_display_name || ' membatalkan jadwal sesi konseling.',
                '/counselor/schedule'
            );
        ELSIF NEW.status = 'awaiting_patient_choice' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'psikolog_cancelled_choice',
                'Jadwal Konseling Dibatalkan Psikolog',
                'Psikolog berhalangan hadir. Silakan pilih jadwal pengganti atau pengembalian koin penuh 100%.',
                '/patient/schedule'
            );
        ELSIF NEW.status = 'in_progress' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'session_started',
                'Sesi Konseling Dimulai',
                'Sesi konseling Anda telah dimulai. Silakan masuk ke ruang konsultasi.',
                '/patient/session/' || NEW.id
            );
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'session_started',
                'Sesi Konseling Dimulai',
                'Sesi konseling bersama ' || NEW.patient_display_name || ' telah dimulai. Silakan masuk ke ruang konsultasi.',
                '/counselor/room?booking=' || NEW.id
            );
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

    -- B. Reschedule start_at
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
        IF NEW.extension_status = 'requested' THEN
            PERFORM public.notify_internal(
                NEW.psikolog_id,
                'extension_requested',
                'Permintaan Perpanjangan Sesi',
                'Pasien ' || NEW.patient_display_name || ' mengajukan perpanjangan waktu sesi (+10 menit).',
                '/counselor/room?booking=' || NEW.id
            );
        ELSIF NEW.extension_status = 'approved' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'extension_approved',
                'Perpanjangan Sesi Disetujui',
                'Psikolog telah menyetujui perpanjangan waktu sesi (+10 menit).',
                '/patient/session/' || NEW.id
            );
        ELSIF NEW.extension_status = 'declined' THEN
            PERFORM public.notify_internal(
                NEW.patient_id,
                'extension_declined',
                'Perpanjangan Sesi Ditolak',
                'Psikolog belum dapat memperpanjang sesi kali ini.',
                '/patient/session/' || NEW.id
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

-- 6. TRIGGER NOTIFIKASI TIPS
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

-- 7. TRIGGER NOTIFIKASI STRIKES & SUSPENSI
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

-- 8. PEMBARUAN SESSION_TICK
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

    -- PENGINGAT 1: 60 MENIT
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

            PERFORM public.notify_internal(
                v_booking.patient_id,
                'session_reminder_60',
                'Pengingat Sesi Konseling (1 Jam Lagi)',
                'Sesi konseling Anda akan dimulai dalam 1 jam (pukul ' || pg_catalog.to_char(v_booking.start_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB). Mohon bersiap.',
                '/patient/schedule'
            );

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

    -- PENGINGAT 2: 10 MENIT
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

            PERFORM public.notify_internal(
                v_booking.patient_id,
                'session_reminder_10',
                'Pengingat Sesi Konseling (10 Menit Lagi)',
                'Sesi konseling Anda akan dimulai dalam 10 menit. Silakan bersiap masuk ke ruang konsultasi.',
                '/patient/session/' || v_booking.id
            );

            PERFORM public.notify_internal(
                v_booking.psikolog_id,
                'session_reminder_10',
                'Pengingat Sesi Konseling (10 Menit Lagi)',
                'Sesi konseling bersama pasien ' || v_booking.patient_display_name || ' akan dimulai dalam 10 menit. Mohon bersiap menyapa pasien.',
                '/counselor/room?booking=' || v_booking.id
            );

            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'session_tick error on reminder_10 for booking %: %', v_booking.id, SQLERRM;
        END;
    END LOOP;

    -- 1. Psikolog telat
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

    -- 2. Pasien no-show
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

    -- 3. Hard cap 58 menit
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

    -- 4. Choice deadline lewat
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


-- ========================================================
-- EKSEKUSI PENGUJIAN DRY-RUN (ASSERTIONS)
-- ========================================================

DO $$
DECLARE
    v_psikolog_id UUID := 'b9000000-0000-0000-0000-000000000001';
    v_pasien_id UUID := 'b9000000-0000-0000-0000-000000000002';
    v_other_id UUID := 'b9000000-0000-0000-0000-000000000003';
    v_booking_1 UUID := 'b9a00000-0000-0000-0000-000000000001';
    v_booking_2 UUID := 'b9a00000-0000-0000-0000-000000000002';
    v_booking_3 UUID := 'b9a00000-0000-0000-0000-000000000003';
    v_tip_id UUID := 'b9f00000-0000-0000-0000-000000000001';
    v_count BIGINT;
    v_body TEXT;
    v_link TEXT;
    v_processed INTEGER;
BEGIN
    -- ----------------------------------------------------
    -- UJI 1: Booking baru -> tepat 1 booking_new untuk psikolog
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name
    ) VALUES (
        v_booking_1,
        v_pasien_id,
        v_psikolog_id,
        pg_catalog.now() + INTERVAL '2 hours',
        'booked',
        'Keluhan konseling untuk uji notifikasi booking baru masuk',
        15, 8500, '[]'::jsonb, 'Budi'
    );

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'booking_new';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 1.1 GAGAL: Harus tepat 1 notifikasi booking_new untuk psikolog, didapat: %', v_count;
    END IF;

    SELECT body INTO v_body
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'booking_new';

    IF v_body NOT LIKE '%Budi%' THEN
        RAISE EXCEPTION 'UJI 1.2 GAGAL: Body booking_new harus memuat nama panggilan pasien (Budi)';
    END IF;

    -- ----------------------------------------------------
    -- UJI 2: session_tick 2x dalam jendela 10 menit -> tepat 1 session_reminder_10 per peserta (idempoten)
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name
    ) VALUES (
        v_booking_2,
        v_pasien_id,
        v_psikolog_id,
        pg_catalog.now() + INTERVAL '5 minutes',
        'booked',
        'Keluhan konseling untuk uji pengingat sesi konseling 10 menit',
        15, 8500, '[]'::jsonb, 'Budi'
    );

    -- Panggilan pertama session_tick()
    v_processed := public.session_tick();

    IF v_processed < 1 THEN
        RAISE EXCEPTION 'UJI 2.1 GAGAL: session_tick harus memproses pengingat 10 menit booking 2';
    END IF;

    -- Cek pengingat 10 menit untuk pasien
    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_pasien_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 2.2 GAGAL: Pasien harus menerima tepat 1 notifikasi session_reminder_10, didapat: %', v_count;
    END IF;

    SELECT link INTO v_link
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_pasien_id;

    IF v_link <> '/patient/session/' || v_booking_2::text THEN
        RAISE EXCEPTION 'UJI 2.2b GAGAL: Link pengingat 10 menit pasien harus /patient/session/%, didapat: %', v_booking_2, v_link;
    END IF;

    -- Cek pengingat 10 menit untuk psikolog
    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_psikolog_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 2.3 GAGAL: Psikolog harus menerima tepat 1 notifikasi session_reminder_10, didapat: %', v_count;
    END IF;

    SELECT link INTO v_link
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_psikolog_id;

    IF v_link <> '/counselor/room?booking=' || v_booking_2::text THEN
        RAISE EXCEPTION 'UJI 2.3b GAGAL: Link pengingat 10 menit psikolog harus /counselor/room?booking=%, didapat: %', v_booking_2, v_link;
    END IF;

    -- Panggilan kedua session_tick() pada jendela waktu yang sama -> tidak boleh menghasilkan notifikasi duplikat
    PERFORM public.session_tick();

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_pasien_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 2.4 GAGAL: Idempotensi gagal, pasien menerima duplikat session_reminder_10: %', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE type = 'session_reminder_10' AND user_id = v_psikolog_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 2.5 GAGAL: Idempotensi gagal, psikolog menerima duplikat session_reminder_10: %', v_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: Batal pasien -> 1 notifikasi booking_cancelled ke psikolog
    -- ----------------------------------------------------
    UPDATE public.bookings
    SET status = 'cancelled_by_patient',
        cancelled_at = pg_catalog.now()
    WHERE id = v_booking_1;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'booking_cancelled';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 3.1 GAGAL: Psikolog harus menerima tepat 1 notifikasi booking_cancelled, didapat: %', v_count;
    END IF;

    SELECT body INTO v_body
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'booking_cancelled';

    IF v_body NOT LIKE '%Budi%' THEN
        RAISE EXCEPTION 'UJI 3.2 GAGAL: Body booking_cancelled harus memuat nama panggilan pasien (Budi)';
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: Tip -> tip_received ke psikolog tanpa nama pasien
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name, ended_at
    ) VALUES (
        v_booking_3,
        v_pasien_id,
        v_psikolog_id,
        pg_catalog.now() - INTERVAL '2 hours',
        'completed',
        'Keluhan konseling untuk uji pemberian tip psikolog',
        15, 8500, '[]'::jsonb, 'Budi',
        pg_catalog.now() - INTERVAL '1 hour'
    );

    INSERT INTO public.tips (
        id, patient_id, mitra_id, coins, mitra_share_bps, source_type, source_id
    ) VALUES (
        v_tip_id,
        v_pasien_id,
        v_psikolog_id,
        5,
        8500,
        'session',
        v_booking_3
    );

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'tip_received';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 4.1 GAGAL: Psikolog harus menerima tepat 1 notifikasi tip_received, didapat: %', v_count;
    END IF;

    SELECT body INTO v_body
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'tip_received';

    IF v_body LIKE '%Budi%' OR v_body LIKE '%Santoso%' THEN
        RAISE EXCEPTION 'UJI 4.2 GAGAL: Notifikasi tip_received tidak boleh memuat nama pasien (harus anonim), didapat: %', v_body;
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: RLS user lain 0 baris
    -- ----------------------------------------------------
    -- Pengguna 'other' (user 3) mencoba membaca notifikasi
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-000000000003"}', true);

    SELECT COUNT(*) INTO v_count FROM public.notifications;

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'UJI 5.1 GAGAL: RLS user lain harus membaca 0 baris, didapat: %', v_count;
    END IF;

    -- Psikolog membaca notifikasi -> harus membaca notifikasi miliknya sendiri
    PERFORM set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-000000000001"}', true);

    SELECT COUNT(*) INTO v_count FROM public.notifications;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'UJI 5.2 GAGAL: Psikolog harus dapat membaca notifikasinya sendiri lewat RLS';
    END IF;

    -- Reset context role postgres
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- ----------------------------------------------------
    -- UJI 6: Penalti Strike, Suspensi & Perpanjangan Sesi
    -- ----------------------------------------------------
    -- Strike added
    INSERT INTO public.psikolog_strikes (psikolog_id, booking_id, points, reason)
    VALUES (v_psikolog_id, v_booking_2, 1, 'late_cancel');

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'strike_added';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 6.1 GAGAL: Psikolog harus menerima notifikasi strike_added';
    END IF;

    -- Suspended
    UPDATE public.psikolog_profiles
    SET suspended_until = pg_catalog.now() + INTERVAL '7 days'
    WHERE user_id = v_psikolog_id;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'suspended';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 6.2 GAGAL: Psikolog harus menerima notifikasi suspended saat akun ditangguhkan';
    END IF;

    -- Reschedule
    UPDATE public.bookings
    SET start_at = pg_catalog.now() + INTERVAL '3 hours'
    WHERE id = v_booking_2;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'reschedule';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 6.3 GAGAL: Psikolog harus menerima notifikasi reschedule saat start_at berubah';
    END IF;

    -- Extension requested & approved
    UPDATE public.bookings
    SET extension_status = 'requested'
    WHERE id = v_booking_2;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'extension_requested';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 6.4 GAGAL: Psikolog harus menerima notifikasi extension_requested';
    END IF;

    SELECT link INTO v_link
    FROM public.notifications
    WHERE user_id = v_psikolog_id AND type = 'extension_requested';

    IF v_link <> '/counselor/room?booking=' || v_booking_2::text THEN
        RAISE EXCEPTION 'UJI 6.4b GAGAL: Link extension_requested harus /counselor/room?booking=%, didapat: %', v_booking_2, v_link;
    END IF;

    UPDATE public.bookings
    SET extension_status = 'approved'
    WHERE id = v_booking_2;

    SELECT COUNT(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_pasien_id AND type = 'extension_approved';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'UJI 6.5 GAGAL: Pasien harus menerima notifikasi extension_approved';
    END IF;

    SELECT link INTO v_link
    FROM public.notifications
    WHERE user_id = v_pasien_id AND type = 'extension_approved';

    IF v_link <> '/patient/session/' || v_booking_2::text THEN
        RAISE EXCEPTION 'UJI 6.5b GAGAL: Link extension_approved harus /patient/session/%, didapat: %', v_booking_2, v_link;
    END IF;

    RAISE NOTICE 'B9 DRY-RUN TESTS PASSED: All 6 notification test suites succeeded cleanly.';
END;
$$;

ROLLBACK;
