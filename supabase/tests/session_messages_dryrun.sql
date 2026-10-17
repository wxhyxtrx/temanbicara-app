-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000014 (SESSION MESSAGES & REALTIME)
-- Path: supabase/tests/session_messages_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 1 pasien, 1 user lain (unauthorized)
-- 2. DDL Salinan persis dari 20261017000014_session_messages.sql
-- 3. Assert pesan pertama psikolog -> status 'in_progress' & psikolog_first_msg_at terisi
-- 4. Assert pesan kedua psikolog tidak mengubah timestamp psikolog_first_msg_at
-- 5. Assert psikolog telat (first message > start_at) -> psikolog_late = true
-- 6. Assert pesan pertama pasien -> patient_first_msg_at terisi
-- 7. Assert RLS SELECT: user lain melihat 0 baris via request.jwt.claims & SET LOCAL ROLE authenticated
-- 8. Assert RLS SELECT: pasien dan psikolog melihat pesan booking miliknya
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b6000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6_other@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b6000000-0000-0000-0000-000000000001', 'b6_psikolog@temanbicara.test', '081299990061', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b6000000-0000-0000-0000-000000000002', 'b6_pasien@temanbicara.test', '081299990062', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6000000-0000-0000-0000-000000000003', 'b6_other@temanbicara.test', '081299990063', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL PSIKOLOG
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins
) VALUES (
    'b6000000-0000-0000-0000-000000000001', 'Dr. B6 Psikolog, M.Psi', 'SIPP-B6-001', 'https://storage.test/sipp-b6.pdf',
    ARRAY['Kecemasan', 'Stres Kerja'], 5, 120000, false, 2
)
ON CONFLICT (user_id) DO UPDATE SET
    tarif_sesi = EXCLUDED.tarif_sesi,
    booking_paused = false;

-- 4. SETUP PROFIL PASIEN
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b6000000-0000-0000-0000-000000000002', 'Pasien Pengujian B6', 'Siti', 'Bpk Siti', '081100000066', false),
    ('b6000000-0000-0000-0000-000000000003', 'User Lain Tidak Terkait', 'Anon', 'Kontak Lain', '081100000077', true)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    nama_panggilan = EXCLUDED.nama_panggilan;

-- ========================================================
-- SALINAN DDL DARI MIGRATION 20261017000014_session_messages.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.session_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice')),
    body TEXT NULL CHECK (body IS NULL OR pg_catalog.char_length(body) <= 4000),
    media_path TEXT NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_session_message_content CHECK (
        (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
        (kind IN ('image', 'voice') AND media_path IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_session_messages_booking_created
    ON public.session_messages (booking_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_session_messages_sender_id
    ON public.session_messages (sender_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.session_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_messages_select_participant ON public.session_messages;
CREATE POLICY session_messages_select_participant ON public.session_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = session_messages.booking_id
              AND (b.patient_id = auth.uid() OR b.psikolog_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS session_messages_insert_service_only ON public.session_messages;

CREATE OR REPLACE FUNCTION public.session_message_after_insert_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_is_late BOOLEAN;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = NEW.booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Bila pengirim adalah psikolog booking ini
    IF NEW.sender_id = v_booking.psikolog_id THEN
        IF v_booking.psikolog_first_msg_at IS NULL THEN
            v_is_late := (NEW.created_at > v_booking.start_at);

            UPDATE public.bookings
            SET psikolog_first_msg_at = NEW.created_at,
                status = CASE WHEN status = 'booked' THEN 'in_progress' ELSE status END,
                psikolog_late = v_is_late,
                updated_at = pg_catalog.now()
            WHERE id = NEW.booking_id;
        END IF;

    -- Bila pengirim adalah pasien booking ini
    ELSIF NEW.sender_id = v_booking.patient_id THEN
        IF v_booking.patient_first_msg_at IS NULL THEN
            UPDATE public.bookings
            SET patient_first_msg_at = NEW.created_at,
                updated_at = pg_catalog.now()
            WHERE id = NEW.booking_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_message_after_insert ON public.session_messages;
CREATE TRIGGER trg_session_message_after_insert
    AFTER INSERT ON public.session_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.session_message_after_insert_fn();

-- ========================================================
-- UJI SKENARIO DRY-RUN
-- ========================================================

DO $$
DECLARE
    v_booking_on_time_id UUID;
    v_booking_late_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_first_ts TIMESTAMPTZ;
    v_second_ts TIMESTAMPTZ;
    v_count_other INTEGER;
    v_count_pasien INTEGER;
    v_count_psikolog INTEGER;
BEGIN
    -- ----------------------------------------------------
    -- 1. SETUP BOOKING 1 (TEPAT WAKTU: start_at 5 menit mendatang)
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, extension_price_coins, refund_policy,
        patient_display_name
    ) VALUES (
        'b6000000-0000-0000-0000-000000000002',
        'b6000000-0000-0000-0000-000000000001',
        pg_catalog.now() + interval '5 minutes',
        'booked',
        'Saya merasa cemas saat berbicara di depan umum sejak dua minggu lalu.',
        10, 8500, 2, '[]'::jsonb,
        'Siti'
    ) RETURNING id INTO v_booking_on_time_id;

    -- ----------------------------------------------------
    -- 2. UJI: Pesan pertama psikolog tepat waktu (< start_at)
    -- Expected: status booked -> in_progress, psikolog_first_msg_at terisi, psikolog_late = false
    -- ----------------------------------------------------
    v_first_ts := pg_catalog.now();
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body, created_at
    ) VALUES (
        v_booking_on_time_id,
        'b6000000-0000-0000-0000-000000000001',
        'text',
        'Halo Siti, selamat datang di sesi konseling hari ini. Silakan sampaikan keluhan Anda.',
        v_first_ts
    );

    SELECT * INTO v_booking FROM public.bookings WHERE id = v_booking_on_time_id;

    ASSERT v_booking.status = 'in_progress',
        format('UJI 1 GAGAL: status seharusnya in_progress, hasil=%s', v_booking.status);
    ASSERT v_booking.psikolog_first_msg_at = v_first_ts,
        format('UJI 1 GAGAL: psikolog_first_msg_at tidak cocok');
    ASSERT v_booking.psikolog_late = false,
        'UJI 1 GAGAL: psikolog_late seharusnya false karena pesan terkirim sebelum start_at';

    -- ----------------------------------------------------
    -- 3. UJI: Pesan kedua psikolog tidak mengubah timestamp
    -- Expected: psikolog_first_msg_at tetap v_first_ts
    -- ----------------------------------------------------
    v_second_ts := v_first_ts + interval '2 minutes';
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body, created_at
    ) VALUES (
        v_booking_on_time_id,
        'b6000000-0000-0000-0000-000000000001',
        'text',
        'Pesan kedua dari psikolog: kita punya waktu 45 menit ke depan.',
        v_second_ts
    );

    SELECT * INTO v_booking FROM public.bookings WHERE id = v_booking_on_time_id;

    ASSERT v_booking.psikolog_first_msg_at = v_first_ts,
        format('UJI 2 GAGAL: psikolog_first_msg_at berubah menjadi %s (seharusnya tetap %s)', v_booking.psikolog_first_msg_at, v_first_ts);
    ASSERT v_booking.status = 'in_progress',
        'UJI 2 GAGAL: status booking berubah setelah pesan kedua';

    -- ----------------------------------------------------
    -- 4. UJI: Pesan pertama pasien mengisi patient_first_msg_at
    -- ----------------------------------------------------
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body, created_at
    ) VALUES (
        v_booking_on_time_id,
        'b6000000-0000-0000-0000-000000000002',
        'text',
        'Terima kasih dok, belakangan ini detak jantung saya sangat cepat.',
        v_second_ts + interval '10 seconds'
    );

    SELECT * INTO v_booking FROM public.bookings WHERE id = v_booking_on_time_id;

    ASSERT v_booking.patient_first_msg_at IS NOT NULL,
        'UJI 3 GAGAL: patient_first_msg_at belum terisi setelah pasien mengirim pesan';

    -- ----------------------------------------------------
    -- 5. SETUP BOOKING 2 (PSIKOLOG TELAT: start_at 10 menit yang lalu)
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, extension_price_coins, refund_policy,
        patient_display_name
    ) VALUES (
        'b6000000-0000-0000-0000-000000000002',
        'b6000000-0000-0000-0000-000000000001',
        pg_catalog.now() - interval '10 minutes',
        'booked',
        'Konsultasi lanjutan mengenai rasa cemas berlebih.',
        10, 8500, 2, '[]'::jsonb,
        'Siti'
    ) RETURNING id INTO v_booking_late_id;

    -- Psikolog mengirim pesan pertama sekarang (now() > start_at)
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body, created_at
    ) VALUES (
        v_booking_late_id,
        'b6000000-0000-0000-0000-000000000001',
        'text',
        'Halo Siti, mohon maaf atas keterlambatan saya menyapa.',
        pg_catalog.now()
    );

    SELECT * INTO v_booking FROM public.bookings WHERE id = v_booking_late_id;

    ASSERT v_booking.status = 'in_progress',
        format('UJI 4 GAGAL: status booking late seharusnya in_progress, hasil=%s', v_booking.status);
    ASSERT v_booking.psikolog_late = true,
        'UJI 4 GAGAL: psikolog_late seharusnya true karena pesan pertama dikirim setelah start_at';

    RAISE NOTICE 'Step 1-4 Trigger Logic Verified Successfully.';
END $$;

-- ----------------------------------------------------
-- 6. UJI RLS: SELECT HANYA PESERTA BOOKING
-- ----------------------------------------------------

-- Uji sebagai USER LAIN (b6000000-0000-0000-0000-000000000003) -> 0 baris
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', 'b6000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.session_messages;
    ASSERT v_count = 0,
        format('UJI RLS 1 GAGAL: User lain melihat %s baris pesan (seharusnya 0)', v_count);
END $$;

RESET ROLE;

-- Uji sebagai PASIEN (b6000000-0000-0000-0000-000000000002) -> 4 baris
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', 'b6000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.session_messages;
    ASSERT v_count = 4,
        format('UJI RLS 2 GAGAL: Pasien melihat %s baris pesan (seharusnya 4)', v_count);
END $$;

RESET ROLE;

-- Uji sebagai PSIKOLOG (b6000000-0000-0000-0000-000000000001) -> 4 baris
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', 'b6000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.session_messages;
    ASSERT v_count = 4,
        format('UJI RLS 3 GAGAL: Psikolog melihat %s baris pesan (seharusnya 4)', v_count);
END $$;

RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE 'B6a DRY-RUN TESTS PASSED: Trigger logic, psikolog_late, and RLS verified.';
END $$;

ROLLBACK;
