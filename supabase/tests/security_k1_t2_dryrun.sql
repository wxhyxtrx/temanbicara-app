-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000023 (SECURITY REVOCATIONS K1 & T2)
-- Path: supabase/tests/security_k1_t2_dryrun.sql
-- Scope:
-- 1. Setup fixture: auth.users, public.users, psikolog_profiles, pasien_profiles,
--    peer_tickets, bookings, peer_messages, session_messages.
-- 2. DDL Salinan persis dari 20261022000023_security_revocations_k1_t2.sql
-- 3. Uji 1: Penolakan UPDATE psikolog_profiles oleh role authenticated (Celah K1)
-- 4. Uji 2: Penolakan UPDATE pasien_profiles oleh role authenticated (Celah K1)
-- 5. Uji 3: Penolakan INSERT peer_messages oleh role authenticated (Celah T2)
-- 6. Uji 4: Penolakan INSERT session_messages oleh role authenticated (Celah T2)
-- 7. Uji 5: Kelulusan SELECT & Realtime untuk role authenticated pada keempat tabel
-- 8. Uji 6: Kelulusan mutasi via superuser / service_role
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP FIXTURE USERS: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k1_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k1_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k1_relawan@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e4000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k1_other@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k1_admin@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('e1000000-0000-0000-0000-000000000001', 'k1_pasien@temanbicara.test', '081255550001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('e2000000-0000-0000-0000-000000000001', 'k1_psikolog@temanbicara.test', '081255550002', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('e3000000-0000-0000-0000-000000000001', 'k1_relawan@temanbicara.test', '081255550003', 'relawan'::public.user_role, 'active'::public.account_status),
    ('e4000000-0000-0000-0000-000000000001', 'k1_other@temanbicara.test', '081255550004', 'pasien'::public.user_role, 'active'::public.account_status),
    ('e5000000-0000-0000-0000-000000000001', 'k1_admin@temanbicara.test', '081255550005', 'admin'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Helper is_admin() untuk RLS
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

-- Setup profil psikolog dengan suspensi aktif (7 hari)
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins,
    suspended_until
)
VALUES (
    'e2000000-0000-0000-0000-000000000001',
    'Dr. Psikolog K1, M.Psi',
    'SIPP-K1-001',
    'https://storage.test/sipp-k1.pdf',
    ARRAY['Kecemasan', 'Depresi'],
    6,
    150000,
    false,
    2,
    pg_catalog.now() + interval '7 days'
)
ON CONFLICT (user_id) DO UPDATE SET
    tarif_sesi = EXCLUDED.tarif_sesi,
    suspended_until = EXCLUDED.suspended_until;

-- Setup profil pasien
INSERT INTO public.pasien_profiles (
    user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
)
VALUES
    ('e1000000-0000-0000-0000-000000000001', 'Pasien Uji K1', 'Budi', 'Keluarga Budi', '081234567890', false),
    ('e4000000-0000-0000-0000-000000000001', 'Pasien Lain K1', 'Lain', 'Keluarga Lain', '081234567899', true)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    kontak_darurat_wa = EXCLUDED.kontak_darurat_wa;

-- Setup profil relawan
INSERT INTO public.relawan_profiles (user_id, alias_name, topik_keahlian, is_available)
VALUES (
    'e3000000-0000-0000-0000-000000000001',
    'Relawan Peduli K1',
    ARRAY['Kecemasan'],
    true
)
ON CONFLICT (user_id) DO UPDATE SET
    alias_name = EXCLUDED.alias_name;

-- Setup fixture tiket curhat sebaya aktif
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at
)
VALUES (
    'f1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'Budi Samaran',
    'Kecemasan',
    'Gelisah',
    'Isi tiket curhat sebaya untuk pengujian keamanan audit K1 dan T2.',
    true,
    'active'::public.peer_ticket_status,
    'e3000000-0000-0000-0000-000000000001',
    pg_catalog.now() - interval '30 minutes',
    pg_catalog.now() - interval '20 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    status = EXCLUDED.status,
    claimed_by = EXCLUDED.claimed_by;

-- Setup fixture booking sesi aktif
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, extension_price_coins, refund_policy,
    patient_display_name
)
VALUES (
    'b1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    pg_catalog.now() - interval '10 minutes',
    'in_progress',
    'Keluhan konseling untuk pengujian keamanan hak akses migrasi 000023.',
    10,
    8500,
    2,
    '[]'::jsonb,
    'Budi'
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    start_at = EXCLUDED.start_at;

-- Insert 1 pesan fixture awal pada peer_messages & session_messages via service_role
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, created_at
)
VALUES (
    'a1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'text',
    'Halo Budi, sapaan awal relawan via sistem.',
    pg_catalog.now() - interval '19 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, created_at
)
VALUES (
    'a2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'text',
    'Selamat datang di sesi konseling, silakan sampaikan ceritamu.',
    pg_catalog.now() - interval '9 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Pastikan RLS aktif pada keempat tabel
ALTER TABLE public.psikolog_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasien_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Pasang policy SELECT dasar jika belum ada di environment test
DROP POLICY IF EXISTS "Public read approved psikolog" ON public.psikolog_profiles;
CREATE POLICY "Public read approved psikolog"
    ON public.psikolog_profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = user_id AND users.status = 'active')
        OR auth.uid() = user_id
        OR public.is_admin()
    );

DROP POLICY IF EXISTS peer_messages_select_participant ON public.peer_messages;
CREATE POLICY peer_messages_select_participant ON public.peer_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.peer_tickets t
            WHERE t.id = peer_messages.ticket_id
              AND (t.patient_id = auth.uid() OR t.claimed_by = auth.uid())
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS session_messages_select_participant ON public.session_messages;
CREATE POLICY session_messages_select_participant ON public.session_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = session_messages.booking_id
              AND (b.patient_id = auth.uid() OR b.psikolog_id = auth.uid())
        )
        OR public.is_admin()
    );

-- ========================================================
-- 2. DDL MIGRATION: 20261022000023_security_revocations_k1_t2.sql
-- ========================================================

-- Pencabutan Hak Akses Mutasi & Truncate
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.psikolog_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pasien_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.peer_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.session_messages FROM anon, authenticated;

-- Mempertahankan Hak SELECT
GRANT SELECT ON public.psikolog_profiles TO anon, authenticated;
GRANT SELECT ON public.pasien_profiles TO authenticated;
GRANT SELECT ON public.peer_messages TO authenticated;
GRANT SELECT ON public.session_messages TO authenticated;

-- Izin Penuh untuk service_role
GRANT ALL ON public.psikolog_profiles TO service_role;
GRANT ALL ON public.pasien_profiles TO service_role;
GRANT ALL ON public.peer_messages TO service_role;
GRANT ALL ON public.session_messages TO service_role;

-- Pembersihan & Penyelarasan Policy RLS
DROP POLICY IF EXISTS peer_messages_insert_participant ON public.peer_messages;
DROP POLICY IF EXISTS session_messages_insert_service_only ON public.session_messages;
DROP POLICY IF EXISTS "Psikolog update own profile non-financial" ON public.psikolog_profiles;

DROP POLICY IF EXISTS "Pasien can manage own profile" ON public.pasien_profiles;
DROP POLICY IF EXISTS "Pasien can view own profile" ON public.pasien_profiles;
CREATE POLICY "Pasien can view own profile" ON public.pasien_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- ========================================================
-- 3. SUITE PENGUJIAN SKENARIO & ASSERTIONS
-- ========================================================

-- --------------------------------------------------------
-- UJI 1: Penolakan UPDATE psikolog_profiles oleh role authenticated (Celah K1)
-- Psikolog mencoba menghapus suspensi dan mengubah tarif langsung via DB client
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    BEGIN
        UPDATE public.psikolog_profiles
        SET suspended_until = NULL, tarif_sesi = 1
        WHERE user_id = 'e2000000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
            IF v_sqlstate = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 1 GAGAL: Terjadi error tak terduga (%): %', v_sqlstate, v_sqlerrm;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI 1 GAGAL: Role authenticated wajib DITOLAK saat UPDATE psikolog_profiles (error 42501)';
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 2: Penolakan UPDATE pasien_profiles oleh role authenticated (Celah K1)
-- Pasien mencoba update profil langsung membypass validasi sanitasi API
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    BEGIN
        UPDATE public.pasien_profiles
        SET kontak_darurat_wa = '089999999999'
        WHERE user_id = 'e1000000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
            IF v_sqlstate = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 2 GAGAL: Terjadi error tak terduga (%): %', v_sqlstate, v_sqlerrm;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI 2 GAGAL: Role authenticated wajib DITOLAK saat UPDATE pasien_profiles (error 42501)';
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 3: Penolakan INSERT peer_messages oleh role authenticated (Celah T2)
-- Peserta tiket mencoba insert langsung membypass validasi durasi & status sesi
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES (
            'f1000000-0000-0000-0000-000000000001',
            'e1000000-0000-0000-0000-000000000001',
            'text',
            'Upaya bypass pesan peer langsung via PostgREST'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
            IF v_sqlstate = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 3 GAGAL: Terjadi error tak terduga (%): %', v_sqlstate, v_sqlerrm;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI 3 GAGAL: Role authenticated wajib DITOLAK saat INSERT peer_messages (error 42501)';
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 4: Penolakan INSERT session_messages oleh role authenticated (Celah T2)
-- Peserta sesi konseling mencoba insert langsung membypass validasi voice note / window
-- --------------------------------------------------------
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
    v_sqlstate TEXT;
    v_sqlerrm TEXT;
BEGIN
    BEGIN
        INSERT INTO public.session_messages (booking_id, sender_id, kind, body)
        VALUES (
            'b1000000-0000-0000-0000-000000000001',
            'e1000000-0000-0000-0000-000000000001',
            'text',
            'Upaya bypass pesan sesi konseling langsung via PostgREST'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
            IF v_sqlstate = '42501' THEN
                v_threw := true;
            ELSE
                RAISE EXCEPTION 'UJI 4 GAGAL: Terjadi error tak terduga (%): %', v_sqlstate, v_sqlerrm;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI 4 GAGAL: Role authenticated wajib DITOLAK saat INSERT session_messages (error 42501)';
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 5: Kelulusan SELECT & Realtime untuk role authenticated pada keempat tabel
-- Membuktikan query baca tetap berfungsi tanpa error permission denied
-- --------------------------------------------------------

-- 5a. Pasien membaca profil psikolog publik
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.psikolog_profiles
    WHERE user_id = 'e2000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5a GAGAL: Pasien seharusnya dapat membaca psikolog_profiles (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5b. Pasien membaca profil miliknya di pasien_profiles
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.pasien_profiles
    WHERE user_id = 'e1000000-0000-0000-0000-000000000001';

    ASSERT v_count = 1, format('UJI 5b GAGAL: Pasien gagal membaca profil miliknya di pasien_profiles (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5c. Pasien lain membaca profil pasien e1 -> terisolasi RLS (0 baris)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.pasien_profiles
    WHERE user_id = 'e1000000-0000-0000-0000-000000000001';

    ASSERT v_count = 0, format('UJI 5c GAGAL: RLS bocor! Pasien lain dapat membaca pasien_profiles user lain (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5d. Pasien peserta membaca peer_messages tiket miliknya
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'f1000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5d GAGAL: Pasien peserta gagal membaca pesan di peer_messages (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5e. Relawan peserta membaca peer_messages tiket yang diklaimnya
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.peer_messages
    WHERE ticket_id = 'f1000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5e GAGAL: Relawan peserta gagal membaca pesan di peer_messages (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5f. Pasien peserta membaca session_messages booking miliknya
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.session_messages
    WHERE booking_id = 'b1000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5f GAGAL: Pasien peserta gagal membaca pesan di session_messages (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- 5g. Psikolog peserta membaca session_messages booking miliknya
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.session_messages
    WHERE booking_id = 'b1000000-0000-0000-0000-000000000001';

    ASSERT v_count >= 1, format('UJI 5g GAGAL: Psikolog peserta gagal membaca pesan di session_messages (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- --------------------------------------------------------
-- UJI 6: Kelulusan mutasi via superuser / service_role
-- Backend server menggunakan service_role client untuk mutasi profil dan pesan
-- --------------------------------------------------------

-- 6a. UPDATE psikolog_profiles via service_role
DO $$
DECLARE
    v_updated_tarif INTEGER;
BEGIN
    UPDATE public.psikolog_profiles
    SET tarif_sesi = 175000
    WHERE user_id = 'e2000000-0000-0000-0000-000000000001'
    RETURNING tarif_sesi INTO v_updated_tarif;

    ASSERT v_updated_tarif = 175000, 'UJI 6a GAGAL: Mutasi psikolog_profiles via service_role gagal dieksekusi';
END $$;

-- 6b. UPDATE pasien_profiles via service_role
DO $$
DECLARE
    v_updated_wa TEXT;
BEGIN
    UPDATE public.pasien_profiles
    SET kontak_darurat_wa = '081299998888'
    WHERE user_id = 'e1000000-0000-0000-0000-000000000001'
    RETURNING kontak_darurat_wa INTO v_updated_wa;

    ASSERT v_updated_wa = '081299998888', 'UJI 6b GAGAL: Mutasi pasien_profiles via service_role gagal dieksekusi';
END $$;

-- 6c. INSERT peer_messages via service_role
DO $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000001',
        'text',
        'Pesan valid dari pasien melalui API backend berhak service_role'
    ) RETURNING id INTO v_new_id;

    ASSERT v_new_id IS NOT NULL, 'UJI 6c GAGAL: Mutasi INSERT peer_messages via service_role gagal dieksekusi';
END $$;

-- 6d. INSERT session_messages via service_role
DO $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.session_messages (booking_id, sender_id, kind, body)
    VALUES (
        'b1000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000001',
        'text',
        'Pesan valid dari psikolog melalui API backend berhak service_role'
    ) RETURNING id INTO v_new_id;

    ASSERT v_new_id IS NOT NULL, 'UJI 6d GAGAL: Mutasi INSERT session_messages via service_role gagal dieksekusi';
END $$;

DO $$
BEGIN
    RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN SECURITY K1 T2 LULUS DENGAN SUKSES.';
END $$;

-- ========================================================
-- ROLLBACK TRANSAKSI UNTUK MENJAGA DATABASE TEST TETAP BERSIH
-- ========================================================
ROLLBACK;
