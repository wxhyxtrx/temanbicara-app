-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000026 (DATABASE PERMISSIONS HARDENING)
-- Path: supabase/tests/database_permissions_hardening_dryrun.sql
-- Scope:
-- 1. Setup role & fixture data: auth.users, public.users, relawan_profiles,
--    system_settings, peer_tickets, bookings, peer_messages, session_messages, notifications
-- 2. DDL Salinan persis dari 20261022000026_database_permissions_hardening.sql
-- 3. Uji 1: Penolakan mutasi tulis/truncate tabel users/bookings/system_settings/relawan_profiles oleh authenticated (42501)
-- 4. Uji 2: Penolakan eksekusi langsung fungsi trigger security definer oleh authenticated (42501) & has_function_privilege
-- 5. Uji 3: Penolakan SELECT patient_id pada peer_tickets oleh authenticated (42501)
-- 6. Uji 4: Kelulusan SELECT kolom non-sensitif peer_tickets oleh authenticated
-- 7. Uji 5: Kelulusan SELECT peer_messages/session_messages/notifications oleh authenticated (Realtime aman)
-- 8. Uji 6: Kelulusan operasi mutasi via service_role / superuser 100%
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP ROLE (MEMASTIKAN ROLE STANDARD SUPABASE TERSEDIA)
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
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
END $$;

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

-- Helper is_admin() untuk verifikasi RLS
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

-- Profil Relawan
INSERT INTO public.relawan_profiles (user_id, alias_name, topik_keahlian, is_available)
VALUES (
    'd8000000-0000-0000-0000-000000000003',
    'Relawan Uji D8',
    ARRAY['Kecemasan'],
    true
)
ON CONFLICT (user_id) DO UPDATE SET alias_name = EXCLUDED.alias_name;

-- System Settings
INSERT INTO public.system_settings (key, value)
VALUES
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24}'::jsonb),
    ('rating', '{"window_days": 7, "min_count_to_show": 3}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Peer Ticket Aktif
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

-- Booking Sesi Aktif
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
-- 3. DDL MIGRATION: 20261022000026_database_permissions_hardening.sql
-- ========================================================

-- 1. Pencabutan Menyeluruh Hak Tulis & Truncate
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Pencabutan Eksekusi Khusus Fungsi Trigger (Security Definer)
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

-- 3. Proteksi Kolom patient_id pada public.peer_tickets
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

-- 4. ALTER DEFAULT PRIVILEGES Eksplisit per Pemilik
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 5. Jaring Pengaman service_role
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
-- UJI 5: Kelulusan SELECT peer_messages, session_messages, dan notifications
-- oleh role authenticated (Supabase Realtime aman)
-- --------------------------------------------------------

-- 5a: peer_messages oleh peserta
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

    ASSERT v_count >= 1, format('UJI 5a GAGAL: Peserta gagal membaca peer_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5b: session_messages oleh peserta
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

    ASSERT v_count >= 1, format('UJI 5b GAGAL: Peserta gagal membaca session_messages (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5c: notifications oleh penerima
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

    ASSERT v_count >= 1, format('UJI 5c GAGAL: Penerima gagal membaca notifications (%s baris)', v_count);
END $$;

RESET ROLE;

-- 5d: Verifikasi hak SELECT tabel pada ketiga tabel
DO $$
BEGIN
    ASSERT has_table_privilege('authenticated', 'public.peer_messages', 'SELECT') = true,
        'UJI 5d GAGAL: authenticated wajib memiliki hak SELECT pada peer_messages';
    ASSERT has_table_privilege('authenticated', 'public.session_messages', 'SELECT') = true,
        'UJI 5e GAGAL: authenticated wajib memiliki hak SELECT pada session_messages';
    ASSERT has_table_privilege('authenticated', 'public.notifications', 'SELECT') = true,
        'UJI 5f GAGAL: authenticated wajib memiliki hak SELECT pada notifications';
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
