-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000030 (PATIENT BOOKING & TICKET NOTIFICATIONS)
-- Path: supabase/tests/patient_booking_ticket_notifications_dryrun.sql
-- Scope:
-- 1. Setup fixture: auth.users, public.users, profiles, system_settings, tables & functions
-- 2. DDL Salinan persis dari 20261031000030_patient_booking_ticket_notifications.sql
-- 3. Uji 1: Booking baru berstatus 'booked' -> notifikasi booking_confirmed ke pasien dengan nama psikolog dan koin
-- 4. Uji 2: Update status booking ke 'confirmed' -> notifikasi booking_confirmed
-- 5. Uji 3: Update booking tanpa perubahan status atau ke status selain booked/confirmed -> tidak mengirim booking_confirmed
-- 6. Uji 4: Booking dengan profil psikolog kosong/tanpa gelar -> fallback 'Psikolog'
-- 7. Uji 5: Tiket curhat baru berstatus 'open' -> notifikasi peer_ticket_created ke /patient/curhat
-- 8. Uji 6: Privasi medis terjaga -> judul/body tidak memuat konten keluhan/cerita
-- 9. Uji 7: Tiket curhat baru dengan status bukan 'open' -> tidak mengirim notifikasi
-- 10. Uji 8: Verifikasi keamanan fungsi (SECURITY DEFINER, search_path = '', hak akses REVOKE & GRANT)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP FIXTURE: USERS, PROFILES, TABLES & FUNCTIONS
-- ========================================================

-- Setup auth.users
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('c3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'psi1_t122@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'psi2_t122@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c3000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pas1_t122@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Setup public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('c3000000-0000-0000-0000-000000000001', 'psi1_t122@temanbicara.test', '081277770001', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('c3000000-0000-0000-0000-000000000002', 'psi2_t122@temanbicara.test', '081277770002', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('c3000000-0000-0000-0000-000000000010', 'pas1_t122@temanbicara.test', '081277770010', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Setup profil psikolog
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused
)
VALUES
    ('c3000000-0000-0000-0000-000000000001', 'Dr. Rahma Psikolog, M.Psi', 'SIPP-T122-001', 'https://storage.test/sipp-t122.pdf', ARRAY['Kecemasan'], 6, 150000, false)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap_gelar = EXCLUDED.nama_lengkap_gelar,
    tarif_sesi = EXCLUDED.tarif_sesi,
    booking_paused = false;

-- Psikolog 2 dibiarkan tidak memiliki profil di psikolog_profiles untuk menguji fallback nama 'Psikolog'
DELETE FROM public.psikolog_profiles WHERE user_id = 'c3000000-0000-0000-0000-000000000002';

-- Setup profil pasien
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('c3000000-0000-0000-0000-000000000010', 'Budi Pasien UAT', 'Budi', 'Ibu Budi', '081100000010', false)
ON CONFLICT (user_id) DO NOTHING;

-- Pastikan tabel notifications ada
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

-- Pastikan notify_internal ada
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

-- Pastikan tabel bookings ada
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    keluhan TEXT NOT NULL,
    price_coins INTEGER NOT NULL,
    mitra_share_bps INTEGER NOT NULL DEFAULT 8500,
    extension_price_coins INTEGER NULL,
    refund_policy JSONB NOT NULL DEFAULT '[]'::jsonb,
    patient_display_name TEXT NOT NULL DEFAULT 'Pasien',
    reschedule_count SMALLINT NOT NULL DEFAULT 0,
    psikolog_first_msg_at TIMESTAMPTZ NULL,
    patient_first_msg_at TIMESTAMPTZ NULL,
    psikolog_late BOOLEAN NOT NULL DEFAULT false,
    extension_status TEXT NULL,
    extension_coins INTEGER NULL,
    ended_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    choice_deadline_at TIMESTAMPTZ NULL,
    refund_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Pastikan tipe enum peer_ticket_status & tabel peer_tickets ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'peer_ticket_status') THEN
        CREATE TYPE public.peer_ticket_status AS ENUM ('open', 'claimed', 'active', 'closed', 'archived');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.peer_tickets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    patient_alias TEXT NOT NULL,
    topic TEXT NOT NULL,
    emotion TEXT NOT NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    status public.peer_ticket_status NOT NULL DEFAULT 'open',
    claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ NULL,
    first_response_at TIMESTAMPTZ NULL,
    closed_at TIMESTAMPTZ NULL,
    closed_by TEXT NULL,
    archived_at TIMESTAMPTZ NULL,
    abandoned_by UUID[] NOT NULL DEFAULT '{}',
    greeting_reminded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);


-- ========================================================
-- 2. DDL SALINAN PERSIS DARI 20261031000030_patient_booking_ticket_notifications.sql
-- ========================================================

-- Trigger 1: Notifikasi Booking Dikonfirmasi
CREATE OR REPLACE FUNCTION public.trg_bookings_notify_patient_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_psikolog_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status NOT IN ('booked', 'confirmed') THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status NOT IN ('booked', 'confirmed') OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

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

DROP TRIGGER IF EXISTS trg_bookings_notify_patient_confirmed ON public.bookings;
CREATE TRIGGER trg_bookings_notify_patient_confirmed
    AFTER INSERT OR UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_bookings_notify_patient_confirmed();

-- Trigger 2: Notifikasi Tiket Curhat Sebaya Dibuat
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

DROP TRIGGER IF EXISTS trg_peer_tickets_notify_patient_created ON public.peer_tickets;
CREATE TRIGGER trg_peer_tickets_notify_patient_created
    AFTER INSERT ON public.peer_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_peer_tickets_notify_patient_created();


-- ========================================================
-- 3. UJI 1: BOOKING BARU BERSTATUS 'booked' (INSERT)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
    v_expected_body TEXT;
BEGIN
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status,
        keluhan, price_coins, patient_display_name
    ) VALUES (
        'e1000000-0000-0000-0000-000000000001',
        'c3000000-0000-0000-0000-000000000010',
        'c3000000-0000-0000-0000-000000000001',
        pg_catalog.now() + INTERVAL '2 days',
        'booked',
        'Saya mengalami kesulitan tidur dan rasa cemas berlebih selama seminggu terakhir.',
        45,
        'Budi'
    );

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Notifikasi booking_confirmed tidak ditemukan untuk pasien';
    END IF;

    IF v_notif.title <> 'Jadwal Konseling Dikonfirmasi' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Judul notifikasi tidak sesuai. Didapat: %', v_notif.title;
    END IF;

    v_expected_body := 'Sesi konseling bersama Dr. Rahma Psikolog, M.Psi berhasil dikonfirmasi. 45 Koin terpotong.';
    IF v_notif.body <> v_expected_body THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Body notifikasi tidak sesuai. Didapat: % | Ekspektasi: %', v_notif.body, v_expected_body;
    END IF;

    IF v_notif.link <> '/patient/schedule' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Link notifikasi harus /patient/schedule, didapat: %', v_notif.link;
    END IF;
END $$;


-- ========================================================
-- 4. UJI 2: UPDATE STATUS BOOKING KE 'confirmed'
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
    v_notif_count INT;
    v_expected_body TEXT;
BEGIN
    -- Buat booking dengan status awaiting_patient_choice
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status,
        keluhan, price_coins, patient_display_name
    ) VALUES (
        'e1000000-0000-0000-0000-000000000002',
        'c3000000-0000-0000-0000-000000000010',
        'c3000000-0000-0000-0000-000000000001',
        pg_catalog.now() + INTERVAL '3 days',
        'awaiting_patient_choice',
        'Perlu penyesuaian jadwal konseling berkala untuk monitoring kecemasan.',
        30,
        'Budi'
    );

    -- Pastikan belum ada notifikasi booking_confirmed untuk booking 2
    SELECT count(*) INTO v_notif_count
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed'
      AND body LIKE '%30 Koin terpotong%';

    IF v_notif_count <> 0 THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Booking berstatus awaiting_patient_choice tidak boleh mengirim notifikasi booking_confirmed';
    END IF;

    -- Update status menjadi 'confirmed'
    UPDATE public.bookings
    SET status = 'confirmed'
    WHERE id = 'e1000000-0000-0000-0000-000000000002';

    -- Verifikasi notifikasi terkirim pasca update status
    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed'
      AND body LIKE '%30 Koin terpotong%';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Notifikasi booking_confirmed tidak terbentuk setelah status diupdate ke confirmed';
    END IF;

    v_expected_body := 'Sesi konseling bersama Dr. Rahma Psikolog, M.Psi berhasil dikonfirmasi. 30 Koin terpotong.';
    IF v_notif.body <> v_expected_body THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Isi pesan notifikasi salah. Didapat: % | Ekspektasi: %', v_notif.body, v_expected_body;
    END IF;
END $$;


-- ========================================================
-- 5. UJI 3: UPDATE LAINNYA TIDAK MEMICU NOTIFIKASI TAMBAHAN
-- ========================================================
DO $$
DECLARE
    v_count_before INT;
    v_count_after INT;
BEGIN
    SELECT count(*) INTO v_count_before
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed';

    -- Update kolom selain status
    UPDATE public.bookings
    SET reschedule_count = reschedule_count + 1
    WHERE id = 'e1000000-0000-0000-0000-000000000001';

    -- Update status menjadi in_progress (bukan booked/confirmed)
    UPDATE public.bookings
    SET status = 'in_progress'
    WHERE id = 'e1000000-0000-0000-0000-000000000001';

    SELECT count(*) INTO v_count_after
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed';

    IF v_count_before <> v_count_after THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Mutasi status in_progress atau update non-status tidak boleh memicu notifikasi booking_confirmed';
    END IF;
END $$;


-- ========================================================
-- 6. UJI 4: FALLBACK NAMA PSIKOLOG KETIKA PROFIL KOSONG
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
    v_expected_body TEXT;
BEGIN
    -- Booking dengan psikolog 2 (tidak memiliki baris di psikolog_profiles)
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status,
        keluhan, price_coins, patient_display_name
    ) VALUES (
        'e1000000-0000-0000-0000-000000000003',
        'c3000000-0000-0000-0000-000000000010',
        'c3000000-0000-0000-0000-000000000002',
        pg_catalog.now() + INTERVAL '4 days',
        'booked',
        'Konseling sesi pengantar mengenai manajemen stres kerja di kantor.',
        50,
        'Budi'
    );

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'booking_confirmed'
      AND body LIKE '%50 Koin terpotong%';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Notifikasi booking_confirmed fallback tidak ditemukan';
    END IF;

    v_expected_body := 'Sesi konseling bersama Psikolog berhasil dikonfirmasi. 50 Koin terpotong.';
    IF v_notif.body <> v_expected_body THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Fallback nama psikolog harus "Psikolog". Didapat: % | Ekspektasi: %', v_notif.body, v_expected_body;
    END IF;
END $$;


-- ========================================================
-- 7. UJI 5: TIKET CURHAT BARU BERSTATUS 'open' (INSERT)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
    v_expected_body TEXT;
BEGIN
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous, status
    ) VALUES (
        't1000000-0000-0000-0000-000000000001',
        'c3000000-0000-0000-0000-000000000010',
        'Bunga Melati',
        'Keluarga',
        'Sedih',
        'Ini adalah isi cerita curhat yang sangat rahasia dan tidak boleh bocor sama sekali ke notifikasi.',
        true,
        'open'
    );

    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'peer_ticket_created';

    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Notifikasi peer_ticket_created tidak ditemukan untuk pasien';
    END IF;

    IF v_notif.title <> 'Tiket Curhat Dibuat' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Judul notifikasi harus "Tiket Curhat Dibuat", didapat: %', v_notif.title;
    END IF;

    v_expected_body := 'Tiket curhat Anda telah berhasil dibuat. Sistem sedang mencarikan pendengar sebaya untukmu.';
    IF v_notif.body <> v_expected_body THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Body notifikasi tiket curhat tidak sesuai. Didapat: % | Ekspektasi: %', v_notif.body, v_expected_body;
    END IF;

    IF v_notif.link <> '/patient/curhat' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Link notifikasi tiket curhat harus /patient/curhat, didapat: %', v_notif.link;
    END IF;
END $$;


-- ========================================================
-- 8. UJI 6: PRIVASI MEDIS TIKET CURHAT TERJAGA (ZERO-LEAK)
-- ========================================================
DO $$
DECLARE
    v_notif RECORD;
BEGIN
    SELECT * INTO v_notif
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'peer_ticket_created';

    IF v_notif.title LIKE '%sangat rahasia%' OR v_notif.body LIKE '%sangat rahasia%' THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Kebocoran isi cerita curhat pada teks notifikasi';
    END IF;

    IF v_notif.title LIKE '%Keluarga%' OR v_notif.body LIKE '%Keluarga%' THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Kebocoran topik curhat pada teks notifikasi';
    END IF;

    IF v_notif.title LIKE '%Sedih%' OR v_notif.body LIKE '%Sedih%' THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Kebocoran emosi curhat pada teks notifikasi';
    END IF;
END $$;


-- ========================================================
-- 9. UJI 7: TIKET DENGAN STATUS BUKAN 'open' TIDAK MEMICU NOTIFIKASI
-- ========================================================
DO $$
DECLARE
    v_notif_count INT;
BEGIN
    -- Insert tiket baru langsung berstatus claimed
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, is_anonymous, status
    ) VALUES (
        't1000000-0000-0000-0000-000000000002',
        'c3000000-0000-0000-0000-000000000010',
        'Bunga Mawar',
        'Karier',
        'Cemas',
        'Cerita tiket non open yang langsung diklaim sistem migrasi.',
        true,
        'claimed'
    );

    -- Hitung notifikasi peer_ticket_created, harus tetap 1 (hanya dari tiket 1)
    SELECT count(*) INTO v_notif_count
    FROM public.notifications
    WHERE user_id = 'c3000000-0000-0000-0000-000000000010'
      AND type = 'peer_ticket_created';

    IF v_notif_count <> 1 THEN
        RAISE EXCEPTION 'UJI 7 GAGAL: Tiket non-open tidak boleh memicu notifikasi peer_ticket_created. Total: %', v_notif_count;
    END IF;
END $$;


-- ========================================================
-- 10. UJI 8: VERIFIKASI KEAMANAN FUNGSI (SECURITY DEFINER, SEARCH_PATH, REVOKE/GRANT)
-- ========================================================
DO $$
DECLARE
    r_fn RECORD;
    v_fn_names TEXT[] := ARRAY[
        'trg_bookings_notify_patient_confirmed',
        'trg_peer_tickets_notify_patient_created'
    ];
    v_name TEXT;
BEGIN
    FOREACH v_name IN ARRAY v_fn_names LOOP
        SELECT proname, prosecdef, proconfig
        INTO r_fn
        FROM pg_proc
        JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
        WHERE n.nspname = 'public'
          AND proname = v_name;

        IF r_fn.proname IS NULL THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: Fungsi % tidak ditemukan di skema public', v_name;
        END IF;

        IF NOT r_fn.prosecdef THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: Fungsi % wajib bertipe SECURITY DEFINER', v_name;
        END IF;

        IF r_fn.proconfig IS NULL OR NOT ('search_path=' = ANY(r_fn.proconfig)) THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: Fungsi % wajib memiliki SET search_path = ''''', v_name;
        END IF;

        -- Periksa pencabutan hak eksekusi dari role publik/anon
        IF has_function_privilege('anon', 'public.' || v_name || '()', 'EXECUTE') THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: Hak EXECUTE fungsi % harus dicabut dari anon', v_name;
        END IF;

        IF has_function_privilege('authenticated', 'public.' || v_name || '()', 'EXECUTE') THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: Hak EXECUTE fungsi % harus dicabut dari authenticated', v_name;
        END IF;

        IF NOT has_function_privilege('service_role', 'public.' || v_name || '()', 'EXECUTE') THEN
            RAISE EXCEPTION 'UJI 8 GAGAL: service_role wajib memiliki hak EXECUTE pada fungsi %', v_name;
        END IF;
    END LOOP;
END $$;


-- ========================================================
-- KESIMPULAN SUITE PENGUJIAN
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'SELURUH UJI DRY-RUN MIGRASI 000030 NOTIFIKASI BOOKING & TIKET CURHAT LULUS SEMPURNA.';
END $$;

ROLLBACK;
