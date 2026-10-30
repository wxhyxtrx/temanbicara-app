-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000026 (DATABASE PERMISSIONS HARDENING & RLS HELPER & PRD-021)
-- Path: supabase/tests/database_permissions_hardening_dryrun.sql
-- Scope:
-- 1. Setup role & simulasi default privileges Supabase (mencegah hijau palsu)
--    Fixture data: auth.users, public.users, relawan_profiles,
--    system_settings, peer_tickets, bookings, peer_messages, session_messages, notifications
-- 2. DDL 8 Blok Salinan persis dari 20261022000026_database_permissions_hardening.sql:
--    - Blok 1: Penguatan public.is_admin() (SECURITY DEFINER)
--    - Blok 2: Helper public.is_peer_ticket_participant (SECURITY DEFINER)
--    - Blok 3: Pembaruan policy peer_messages_select_participant via helper
--    - Blok 4: Proteksi kolom patient_id & batasan 16 kolom non-sensitif peer_tickets
--    - Blok 5: Pencabutan hak tulis/truncate seluruh tabel public dari anon/authenticated
--    - Blok 6: Pencabutan eksekusi fungsi trigger security definer
--    - Blok 7: ALTER DEFAULT PRIVILEGES (postgres)
--    - Blok 8: Jaring pengaman hak akses service_role
-- 3. Uji 1: Penolakan mutasi tulis/truncate tabel public oleh authenticated (error 42501)
-- 4. Uji 2: Penolakan eksekusi langsung fungsi trigger security definer oleh authenticated (42501) & has_function_privilege false
-- 5. Uji 3: Penolakan SELECT patient_id & SELECT * pada peer_tickets oleh authenticated (42501) & has_column_privilege false
-- 6. Uji 4: Kelulusan SELECT 16 kolom non-sensitif peer_tickets oleh authenticated & has_column_privilege true
-- 7. Uji 5: Kasus Positif & Negatif RLS peer_messages (Inti Temuan QA PRD-020):
--    - 5a: Kasus Positif Pasien Peserta membaca pesan (>= 1 baris, tanpa error 42501)
--    - 5b: Kasus Positif Relawan Peserta membaca pesan (>= 1 baris, tanpa error 42501)
--    - 5c: Kasus Negatif Non-Peserta membaca pesan (tepat 0 baris, tanpa error 42501)
--    - 5d: Kasus Admin membaca pesan (>= 1 baris)
--    - 5e: Pembacaan session_messages oleh peserta booking (>= 1 baris)
--    - 5f: Pembacaan notifications oleh penerima (>= 1 baris)
--    - 5g-5i: Hak SELECT tabel pada peer_messages, session_messages, notifications
--    - 5j-5k: Hak eksekusi helper is_peer_ticket_participant & is_admin
-- 8. Uji 6: Kelulusan operasi mutasi via service_role / superuser 100%
-- 9. Uji 7: Verifikasi default privileges objek baru (tabel, fungsi, sequence) untuk authenticated, anon, dan service_role (PRD-021)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP ROLE & SIMULASI DEFAULT PRIVILEGES SUPABASE
-- ========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role BYPASSRLS;
    END IF;
END $$;

-- Simulasi default privileges bawaan Supabase sebelum hardening (mencegah hijau palsu)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ========================================================
-- 2. SETUP FIXTURE DATA: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('d8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd8_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('d8000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd8_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('d8000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd8_relawan@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('d8000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd8_other@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('d8000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd8_admin@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('d8000000-0000-0000-0000-000000000001', 'd8_pasien@temanbicara.test', '081277770001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('d8000000-0000-0000-0000-000000000002', 'd8_psikolog@temanbicara.test', '081277770002', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('d8000000-0000-0000-0000-000000000003', 'd8_relawan@temanbicara.test', '081277770003', 'relawan'::public.user_role, 'active'::public.account_status),
    ('d8000000-0000-0000-0000-000000000004', 'd8_other@temanbicara.test', '081277770004', 'pasien'::public.user_role, 'active'::public.account_status),
    ('d8000000-0000-0000-0000-000000000005', 'd8_admin@temanbicara.test', '081277770005', 'admin'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Profil Relawan Fixture
INSERT INTO public.relawan_profiles (user_id, alias_name, topik_keahlian, is_available)
VALUES (
    'd8000000-0000-0000-0000-000000000003',
    'Relawan Uji D8',
    ARRAY['Kecemasan'],
    true
)
ON CONFLICT (user_id) DO UPDATE SET alias_name = EXCLUDED.alias_name;

-- System Settings Fixture
INSERT INTO public.system_settings (key, value)
VALUES
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24}'::jsonb),
    ('rating', '{"window_days": 7, "min_count_to_show": 3}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Peer Ticket Aktif Fixture
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'e8000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'Pasien Samaran D8',
    'Kecemasan',
    'Gelisah',
    'Tiket curhat sebaya untuk pengujian database permissions hardening.',
    true,
    'active'::public.peer_ticket_status,
    'd8000000-0000-0000-0000-000000000003',
    pg_catalog.now() - interval '30 minutes',
    pg_catalog.now() - interval '20 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    status = EXCLUDED.status,
    claimed_by = EXCLUDED.claimed_by;

-- Booking Sesi Aktif Fixture
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, extension_price_coins, refund_policy,
    patient_display_name
)
VALUES (
    'c8000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000002',
    pg_catalog.now() - interval '10 minutes',
    'in_progress',
    'Keluhan konseling untuk pengujian database permissions hardening.',
    10,
    8500,
    2,
    '[]'::jsonb,
    'Pasien D8'
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    start_at = EXCLUDED.start_at;

-- Peer Messages Fixture
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, created_at
)
VALUES (
    'a8000000-0000-0000-0000-000000000001',
    'e8000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000003',
    'text',
    'Halo, relawan siap mendengarkan cerita kamu.',
    pg_catalog.now() - interval '19 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Session Messages Fixture
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, created_at
)
VALUES (
    'a8000000-0000-0000-0000-000000000002',
    'c8000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000002',
    'text',
    'Selamat datang di sesi konseling, silakan mulai cerita.',
    pg_catalog.now() - interval '9 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Notifications Fixture
INSERT INTO public.notifications (
    id, user_id, type, title, body, created_at
)
VALUES (
    'a8000000-0000-0000-0000-000000000003',
    'd8000000-0000-0000-0000-000000000001',
    'booking_reminder',
    'Pengingat Sesi',
    'Sesi konseling Anda akan dimulai.',
    pg_catalog.now() - interval '5 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Fungsi trigger security definer uji coba (memastikan fungsi trigger ada dan memiliki grant awal ke PUBLIC)
CREATE OR REPLACE FUNCTION public.trg_audit_system_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trg_audit_system_setting() TO PUBLIC, anon, authenticated;

-- ========================================================
-- 3. DDL MIGRATION: 20261022000026_database_permissions_hardening.sql (8 BLOK LENGKAP)
-- ========================================================

-- Blok 1: Pemeriksaan & Penguatan Fungsi public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'::public.user_role
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Blok 2: Helper Kepesertaan Tiket public.is_peer_ticket_participant(p_ticket_id UUID)
CREATE OR REPLACE FUNCTION public.is_peer_ticket_participant(p_ticket_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.peer_tickets
        WHERE id = p_ticket_id
          AND (patient_id = auth.uid() OR claimed_by = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_peer_ticket_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_peer_ticket_participant(UUID) TO authenticated, service_role;

-- Blok 3: Pembaruan Policy RLS peer_messages_select_participant
DROP POLICY IF EXISTS peer_messages_select_participant ON public.peer_messages;
CREATE POLICY peer_messages_select_participant ON public.peer_messages
    FOR SELECT TO authenticated
    USING (
        public.is_peer_ticket_participant(ticket_id)
        OR public.is_admin()
    );

-- Blok 4: Proteksi Kolom patient_id pada public.peer_tickets
REVOKE SELECT ON public.peer_tickets FROM authenticated, anon;

GRANT SELECT (
    id,
    patient_alias,
    topic,
    emotion,
    content,
    is_anonymous,
    status,
    claimed_by,
    claimed_at,
    first_response_at,
    closed_at,
    closed_by,
    archived_at,
    abandoned_by,
    created_at,
    updated_at
) ON public.peer_tickets TO authenticated;

-- Blok 5: Pencabutan Menyeluruh Hak Tulis & Truncate
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Blok 6: Pencabutan Eksekusi Khusus Fungsi Trigger (Security Definer)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS func_name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prorettype = 'trigger'::regtype
          AND p.prosecdef = true
    LOOP
        EXECUTE 'REVOKE ALL ON FUNCTION ' || r.func_name || ' FROM PUBLIC, anon, authenticated;';
    END LOOP;
END $$;

-- Blok 7: ALTER DEFAULT PRIVILEGES Eksplisit per Pemilik
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Blok 8: Jaring Pengaman service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ========================================================
-- 4. SUITE PENGUJIAN SKENARIO & ASSERTIONS
-- ========================================================

-- --------------------------------------------------------
-- UJI 1: Penolakan mutasi tulis/truncate tabel users, bookings,
-- system_settings, dan relawan_profiles oleh role authenticated (error 42501)
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

-- 1a: Penolakan INSERT public.users
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.users (id, email, no_wa, role, status)
        VALUES ('d8000000-0000-0000-0000-000000000099', 'hacked@test.com', '081299999999', 'admin'::public.user_role, 'active'::public.account_status);
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1a GAGAL: INSERT users oleh authenticated wajib ditolak (42501)';
END $$;

-- 1b: Penolakan UPDATE public.bookings
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.bookings SET status = 'cancelled' WHERE id = 'c8000000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1b GAGAL: UPDATE bookings oleh authenticated wajib ditolak (42501)';
END $$;

-- 1c: Penolakan UPDATE public.system_settings
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.system_settings SET value = '{"tampered":true}'::jsonb WHERE key = 'relawan';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1c GAGAL: UPDATE system_settings oleh authenticated wajib ditolak (42501)';
END $$;

-- 1d: Penolakan UPDATE public.relawan_profiles
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.relawan_profiles SET is_available = false WHERE user_id = 'd8000000-0000-0000-0000-000000000003';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1d GAGAL: UPDATE relawan_profiles oleh authenticated wajib ditolak (42501)';
END $$;

-- 1e: Penolakan DELETE public.relawan_profiles
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        DELETE FROM public.relawan_profiles WHERE user_id = 'd8000000-0000-0000-0000-000000000003';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1e GAGAL: DELETE relawan_profiles oleh authenticated wajib ditolak (42501)';
END $$;

-- 1f: Penolakan TRUNCATE public.relawan_profiles
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        TRUNCATE public.relawan_profiles;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 1f GAGAL: TRUNCATE relawan_profiles oleh authenticated wajib ditolak (42501)';
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 2: Penolakan eksekusi langsung fungsi trigger security definer (error 42501)
-- dan verifikasi via has_function_privilege
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM public.trg_audit_system_setting();
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 2 GAGAL: Eksekusi langsung fungsi trigger security definer oleh authenticated wajib ditolak (42501)';
END $$;

RESET ROLE;

-- Verifikasi via has_function_privilege
DO $$
BEGIN
    ASSERT has_function_privilege('authenticated', 'public.trg_audit_system_setting()', 'EXECUTE') = false,
        'UJI 2 GAGAL: has_function_privilege authenticated pada trg_audit_system_setting() wajib false';
    ASSERT has_function_privilege('anon', 'public.trg_audit_system_setting()', 'EXECUTE') = false,
        'UJI 2 GAGAL: has_function_privilege anon pada trg_audit_system_setting() wajib false';
    ASSERT has_function_privilege('public', 'public.trg_audit_system_setting()', 'EXECUTE') = false,
        'UJI 2 GAGAL: has_function_privilege public pada trg_audit_system_setting() wajib false';
END $$;

-- --------------------------------------------------------
-- UJI 3: Penolakan SELECT patient_id pada public.peer_tickets oleh authenticated (error 42501)
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw_col BOOLEAN := false;
    v_threw_star BOOLEAN := false;
BEGIN
    -- 3a: Upaya SELECT patient_id secara eksplisit
    BEGIN
        PERFORM patient_id FROM public.peer_tickets LIMIT 1;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw_col := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw_col := true; END IF;
    END;
    ASSERT v_threw_col = true, 'UJI 3a GAGAL: SELECT patient_id pada peer_tickets oleh authenticated wajib ditolak (42501)';

    -- 3b: Upaya SELECT * (mengekspansi semua kolom termasuk patient_id)
    BEGIN
        PERFORM * FROM public.peer_tickets LIMIT 1;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw_star := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw_star := true; END IF;
    END;
    ASSERT v_threw_star = true, 'UJI 3b GAGAL: SELECT * pada peer_tickets oleh authenticated wajib ditolak (42501)';
END $$;

RESET ROLE;

-- 3c: Verifikasi hak akses kolom via has_column_privilege
DO $$
BEGIN
    ASSERT has_column_privilege('authenticated', 'public.peer_tickets', 'patient_id', 'SELECT') = false,
        'UJI 3c GAGAL: has_column_privilege authenticated pada peer_tickets(patient_id) wajib false';
    ASSERT has_column_privilege('anon', 'public.peer_tickets', 'patient_id', 'SELECT') = false,
        'UJI 3d GAGAL: has_column_privilege anon pada peer_tickets(patient_id) wajib false';
END $$;

-- --------------------------------------------------------
-- UJI 4: Kelulusan SELECT kolom non-sensitif public.peer_tickets oleh authenticated
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_id UUID;
    v_alias TEXT;
    v_topic TEXT;
    v_emotion TEXT;
    v_status public.peer_ticket_status;
BEGIN
    SELECT id, patient_alias, topic, emotion, status
    INTO v_id, v_alias, v_topic, v_emotion, v_status
    FROM public.peer_tickets
    WHERE id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_id = 'e8000000-0000-0000-0000-000000000001', 'UJI 4a GAGAL: Kolom id tidak terbaca';
    ASSERT v_alias = 'Pasien Samaran D8', 'UJI 4b GAGAL: Kolom patient_alias tidak terbaca';
    ASSERT v_topic = 'Kecemasan', 'UJI 4c GAGAL: Kolom topic tidak terbaca';
    ASSERT v_emotion = 'Gelisah', 'UJI 4d GAGAL: Kolom emotion tidak terbaca';
    ASSERT v_status = 'active'::public.peer_ticket_status, 'UJI 4e GAGAL: Kolom status tidak terbaca';
END $$;

RESET ROLE;

-- 4f: Verifikasi seluruh 16 kolom non-sensitif dapat dibaca oleh role authenticated
DO $$
DECLARE
    v_cols TEXT[] := ARRAY[
        'id', 'patient_alias', 'topic', 'emotion', 'content', 'is_anonymous',
        'status', 'claimed_by', 'claimed_at', 'first_response_at', 'closed_at',
        'closed_by', 'archived_at', 'abandoned_by', 'created_at', 'updated_at'
    ];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY v_cols LOOP
        ASSERT has_column_privilege('authenticated', 'public.peer_tickets', col, 'SELECT') = true,
            'UJI 4f GAGAL: authenticated wajib memiliki hak SELECT pada kolom peer_tickets.' || col;
    END LOOP;
END $$;

-- --------------------------------------------------------
-- UJI 5: Kasus Positif & Negatif RLS peer_messages (Inti Temuan QA PRD-020)
-- & Realtime session_messages, notifications
-- --------------------------------------------------------

-- 5a: Kasus Positif 1 - Pasien Peserta membaca peer_messages
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5a GAGAL: Pasien peserta wajib dapat membaca peer_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5b: Kasus Positif 2 - Relawan Peserta membaca peer_messages
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5b GAGAL: Relawan peserta wajib dapat membaca peer_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5c: Kasus Negatif - Non-Peserta membaca peer_messages (Isolasi RLS: tepat 0 baris, tanpa error 42501)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_count = 0, format('UJI 5c GAGAL: Non-peserta wajib mengembalikan tepat 0 baris pada peer_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5d: Kasus Admin - Admin membaca peer_messages
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5d GAGAL: Admin wajib dapat membaca peer_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5e: session_messages oleh peserta booking
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.session_messages
    WHERE booking_id = 'c8000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5e GAGAL: Peserta gagal membaca session_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5f: notifications oleh penerima
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = 'd8000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5f GAGAL: Penerima gagal membaca notifications (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5g-5i: Verifikasi hak SELECT tabel pada ketiga tabel
DO $$
BEGIN
    ASSERT has_table_privilege('authenticated', 'public.peer_messages', 'SELECT') = true,
        'UJI 5g GAGAL: authenticated wajib memiliki hak SELECT pada peer_messages';
    ASSERT has_table_privilege('authenticated', 'public.session_messages', 'SELECT') = true,
        'UJI 5h GAGAL: authenticated wajib memiliki hak SELECT pada session_messages';
    ASSERT has_table_privilege('authenticated', 'public.notifications', 'SELECT') = true,
        'UJI 5i GAGAL: authenticated wajib memiliki hak SELECT pada notifications';
END $$;

-- 5j: Verifikasi hak eksekusi helper is_peer_ticket_participant
DO $$
BEGIN
    ASSERT has_function_privilege('authenticated', 'public.is_peer_ticket_participant(uuid)', 'EXECUTE') = true,
        'UJI 5j GAGAL: authenticated wajib memiliki hak EXECUTE pada is_peer_ticket_participant';
    ASSERT has_function_privilege('service_role', 'public.is_peer_ticket_participant(uuid)', 'EXECUTE') = true,
        'UJI 5j GAGAL: service_role wajib memiliki hak EXECUTE pada is_peer_ticket_participant';
    ASSERT has_function_privilege('anon', 'public.is_peer_ticket_participant(uuid)', 'EXECUTE') = false,
        'UJI 5j GAGAL: anon dilarang memiliki hak EXECUTE pada is_peer_ticket_participant';
    ASSERT has_function_privilege('public', 'public.is_peer_ticket_participant(uuid)', 'EXECUTE') = false,
        'UJI 5j GAGAL: public dilarang memiliki hak EXECUTE pada is_peer_ticket_participant';
END $$;

-- 5k: Verifikasi hak eksekusi helper is_admin
DO $$
BEGIN
    ASSERT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') = true,
        'UJI 5k GAGAL: authenticated wajib memiliki hak EXECUTE pada is_admin';
    ASSERT has_function_privilege('service_role', 'public.is_admin()', 'EXECUTE') = true,
        'UJI 5k GAGAL: service_role wajib memiliki hak EXECUTE pada is_admin';
    ASSERT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') = false,
        'UJI 5k GAGAL: anon dilarang memiliki hak EXECUTE pada is_admin';
    ASSERT has_function_privilege('public', 'public.is_admin()', 'EXECUTE') = false,
        'UJI 5k GAGAL: public dilarang memiliki hak EXECUTE pada is_admin';
END $$;

-- --------------------------------------------------------
-- UJI 6: Kelulusan operasi mutasi via service_role / superuser 100%
-- --------------------------------------------------------

-- 6a: Mutasi public.users via service_role
DO $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE public.users
    SET status = 'active'::public.account_status
    WHERE id = 'd8000000-0000-0000-0000-000000000001'
    RETURNING id INTO v_updated_id;

    ASSERT v_updated_id = 'd8000000-0000-0000-0000-000000000001', 'UJI 6a GAGAL: Mutasi users via service_role gagal';
END $$;

-- 6b: Mutasi public.bookings via service_role
DO $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE public.bookings
    SET status = 'in_progress'
    WHERE id = 'c8000000-0000-0000-0000-000000000001'
    RETURNING id INTO v_updated_id;

    ASSERT v_updated_id = 'c8000000-0000-0000-0000-000000000001', 'UJI 6b GAGAL: Mutasi bookings via service_role gagal';
END $$;

-- 6c: Mutasi public.system_settings via service_role
DO $$
DECLARE
    v_key TEXT;
BEGIN
    UPDATE public.system_settings
    SET updated_at = pg_catalog.now()
    WHERE key = 'relawan'
    RETURNING key INTO v_key;

    ASSERT v_key = 'relawan', 'UJI 6c GAGAL: Mutasi system_settings via service_role gagal';
END $$;

-- 6d: Mutasi public.relawan_profiles via service_role
DO $$
DECLARE
    v_uid UUID;
BEGIN
    UPDATE public.relawan_profiles
    SET is_available = true
    WHERE user_id = 'd8000000-0000-0000-0000-000000000003'
    RETURNING user_id INTO v_uid;

    ASSERT v_uid = 'd8000000-0000-0000-0000-000000000003', 'UJI 6d GAGAL: Mutasi relawan_profiles via service_role gagal';
END $$;

-- 6e: SELECT patient_id pada peer_tickets via service_role
DO $$
DECLARE
    v_pid UUID;
BEGIN
    SELECT patient_id INTO v_pid
    FROM public.peer_tickets
    WHERE id = 'e8000000-0000-0000-0000-000000000001';

    ASSERT v_pid = 'd8000000-0000-0000-0000-000000000001', 'UJI 6e GAGAL: service_role wajib dapat membaca patient_id pada peer_tickets';
END $$;

-- 6f: Verifikasi hak akses penuh service_role pada tabel skema public
DO $$
BEGIN
    ASSERT has_table_privilege('service_role', 'public.users', 'INSERT') = true, 'UJI 6f GAGAL: service_role INSERT users';
    ASSERT has_table_privilege('service_role', 'public.users', 'UPDATE') = true, 'UJI 6f GAGAL: service_role UPDATE users';
    ASSERT has_table_privilege('service_role', 'public.users', 'DELETE') = true, 'UJI 6f GAGAL: service_role DELETE users';
    ASSERT has_table_privilege('service_role', 'public.users', 'TRUNCATE') = true, 'UJI 6f GAGAL: service_role TRUNCATE users';

    ASSERT has_table_privilege('service_role', 'public.peer_tickets', 'SELECT') = true, 'UJI 6g GAGAL: service_role SELECT peer_tickets';
    ASSERT has_table_privilege('service_role', 'public.peer_tickets', 'INSERT') = true, 'UJI 6g GAGAL: service_role INSERT peer_tickets';
    ASSERT has_table_privilege('service_role', 'public.peer_tickets', 'UPDATE') = true, 'UJI 6g GAGAL: service_role UPDATE peer_tickets';
    ASSERT has_table_privilege('service_role', 'public.peer_tickets', 'DELETE') = true, 'UJI 6g GAGAL: service_role DELETE peer_tickets';
END $$;

-- --------------------------------------------------------
-- UJI 7: Verifikasi default privileges objek baru (tabel, fungsi, sequence)
-- Memastikan objek baru yang dibuat oleh role postgres tidak terbuka untuk authenticated & anon,
-- serta tetap dapat diakses oleh service_role (PRD-021)
-- --------------------------------------------------------
CREATE TABLE public.test_prd021_default_privs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label text
);

CREATE OR REPLACE FUNCTION public.test_prd021_default_func()
RETURNS text
LANGUAGE sql
AS $$
    SELECT 'test';
$$;

CREATE SEQUENCE public.test_prd021_default_seq;

-- 7a-7b: Verifikasi penolakan mutasi tabel baru untuk authenticated dan anon
DO $$
BEGIN
    ASSERT has_table_privilege('authenticated', 'public.test_prd021_default_privs', 'INSERT') = false,
        'UJI 7a GAGAL: authenticated tidak boleh punya hak INSERT pada tabel baru';
    ASSERT has_table_privilege('authenticated', 'public.test_prd021_default_privs', 'UPDATE') = false,
        'UJI 7a GAGAL: authenticated tidak boleh punya hak UPDATE pada tabel baru';
    ASSERT has_table_privilege('authenticated', 'public.test_prd021_default_privs', 'DELETE') = false,
        'UJI 7a GAGAL: authenticated tidak boleh punya hak DELETE pada tabel baru';
    ASSERT has_table_privilege('authenticated', 'public.test_prd021_default_privs', 'TRUNCATE') = false,
        'UJI 7a GAGAL: authenticated tidak boleh punya hak TRUNCATE pada tabel baru';

    ASSERT has_table_privilege('anon', 'public.test_prd021_default_privs', 'INSERT') = false,
        'UJI 7b GAGAL: anon tidak boleh punya hak INSERT pada tabel baru';
    ASSERT has_table_privilege('anon', 'public.test_prd021_default_privs', 'UPDATE') = false,
        'UJI 7b GAGAL: anon tidak boleh punya hak UPDATE pada tabel baru';
    ASSERT has_table_privilege('anon', 'public.test_prd021_default_privs', 'DELETE') = false,
        'UJI 7b GAGAL: anon tidak boleh punya hak DELETE pada tabel baru';
    ASSERT has_table_privilege('anon', 'public.test_prd021_default_privs', 'TRUNCATE') = false,
        'UJI 7b GAGAL: anon tidak boleh punya hak TRUNCATE pada tabel baru';
END $$;

-- 7c: Verifikasi penolakan eksekusi fungsi baru untuk authenticated dan anon
DO $$
BEGIN
    ASSERT has_function_privilege('authenticated', 'public.test_prd021_default_func()', 'EXECUTE') = false,
        'UJI 7c GAGAL: authenticated tidak boleh punya hak EXECUTE pada fungsi baru';
    ASSERT has_function_privilege('anon', 'public.test_prd021_default_func()', 'EXECUTE') = false,
        'UJI 7c GAGAL: anon tidak boleh punya hak EXECUTE pada fungsi baru';
END $$;

-- 7d: Verifikasi penolakan hak akses sequence baru untuk authenticated dan anon
DO $$
BEGIN
    ASSERT has_sequence_privilege('authenticated', 'public.test_prd021_default_seq', 'USAGE') = false,
        'UJI 7d GAGAL: authenticated tidak boleh punya hak USAGE pada sequence baru';
    ASSERT has_sequence_privilege('anon', 'public.test_prd021_default_seq', 'USAGE') = false,
        'UJI 7d GAGAL: anon tidak boleh punya hak USAGE pada sequence baru';
END $$;

-- 7e: Verifikasi hak akses service_role pada tabel, fungsi, dan sequence baru
DO $$
BEGIN
    ASSERT has_table_privilege('service_role', 'public.test_prd021_default_privs', 'SELECT') = true,
        'UJI 7e GAGAL: service_role wajib punya hak SELECT pada tabel baru';
    ASSERT has_table_privilege('service_role', 'public.test_prd021_default_privs', 'INSERT') = true,
        'UJI 7e GAGAL: service_role wajib punya hak INSERT pada tabel baru';
    ASSERT has_table_privilege('service_role', 'public.test_prd021_default_privs', 'UPDATE') = true,
        'UJI 7e GAGAL: service_role wajib punya hak UPDATE pada tabel baru';
    ASSERT has_table_privilege('service_role', 'public.test_prd021_default_privs', 'DELETE') = true,
        'UJI 7e GAGAL: service_role wajib punya hak DELETE pada tabel baru';
    ASSERT has_table_privilege('service_role', 'public.test_prd021_default_privs', 'TRUNCATE') = true,
        'UJI 7e GAGAL: service_role wajib punya hak TRUNCATE pada tabel baru';
    ASSERT has_function_privilege('service_role', 'public.test_prd021_default_func()', 'EXECUTE') = true,
        'UJI 7e GAGAL: service_role wajib punya hak EXECUTE pada fungsi baru';
    ASSERT has_sequence_privilege('service_role', 'public.test_prd021_default_seq', 'USAGE') = true,
        'UJI 7e GAGAL: service_role wajib punya hak USAGE pada sequence baru';
END $$;

-- ========================================================
-- NOTIFIKASI KELULUSAN
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN DATABASE PERMISSIONS HARDENING LULUS DENGAN SUKSES.';
END $$;

-- ========================================================
-- ROLLBACK TRANSAKSI UNTUK MENJAGA DATABASE TETAP BERSIH
-- ========================================================
ROLLBACK;
