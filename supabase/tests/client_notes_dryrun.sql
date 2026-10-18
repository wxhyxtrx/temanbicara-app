-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000016 (CLIENT NOTES & EMERGENCY CONTACT LOG)
-- Path: supabase/tests/client_notes_dryrun.sql
-- Scope:
-- 1. Setup user test: 2 psikolog (A & B), 1 pasien, 1 admin
-- 2. DDL Salinan persis dari 20261017000016_client_notes.sql
-- 3. Assert RPC client_note_upsert:
--    - Psikolog A berhasil menulis & memperbarui catatan sesi
--    - Psikolog B ditolak saat mencoba menulis catatan sesi milik Psikolog A (FORBIDDEN)
--    - Ditolak pada status booking 'booked' (hanya in_progress / completed)
--    - Ditolak jika panjang teks > 5000 karakter
-- 4. Assert RLS client_notes:
--    - Psikolog B SELECT client_notes -> 0 baris (tidak bisa membaca catatan Psikolog A)
--    - Pasien SELECT client_notes -> 0 baris (tidak bisa membaca catatan klinis)
--    - Admin SELECT client_notes -> 0 baris (privasi absolut dokter/psikolog)
--    - Psikolog A SELECT client_notes -> 1 baris (hanya catatannya sendiri)
-- 5. Assert RLS emergency_contact_access_log:
--    - Tabel emergency_contact_access_log ada
--    - Non-admin (psikolog / pasien) SELECT -> 0 baris
--    - Admin SELECT -> melihat baris audit log
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7_psikolog_a@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b7000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7_psikolog_b@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b7000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b7000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7_admin@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b7000000-0000-0000-0000-000000000001', 'b7_psikolog_a@temanbicara.test', '081299990071', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b7000000-0000-0000-0000-000000000002', 'b7_psikolog_b@temanbicara.test', '081299990072', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b7000000-0000-0000-0000-000000000003', 'b7_pasien@temanbicara.test', '081299990073', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b7000000-0000-0000-0000-000000000004', 'b7_admin@temanbicara.test', '081299990074', 'admin'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL PSIKOLOG A & B
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused
) VALUES
    ('b7000000-0000-0000-0000-000000000001', 'Dr. Psikolog A, M.Psi', 'SIPP-B7-001', 'https://storage.test/sipp-b7a.pdf', ARRAY['Kecemasan'], 5, 120000, false),
    ('b7000000-0000-0000-0000-000000000002', 'Dr. Psikolog B, M.Psi', 'SIPP-B7-002', 'https://storage.test/sipp-b7b.pdf', ARRAY['Depresi'], 7, 150000, false)
ON CONFLICT (user_id) DO UPDATE SET tarif_sesi = EXCLUDED.tarif_sesi, booking_paused = false;

-- 4. SETUP PROFIL PASIEN
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b7000000-0000-0000-0000-000000000003', 'Rina Pasien Rahasia', 'Rina', 'Ibu Rina', '081122334455', false)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    nama_panggilan = EXCLUDED.nama_panggilan,
    kontak_darurat_nama = EXCLUDED.kontak_darurat_nama,
    kontak_darurat_wa = EXCLUDED.kontak_darurat_wa;

-- 5. SETUP PROFIL ADMIN
INSERT INTO public.admin_profiles (user_id, nama_lengkap, level)
VALUES
    ('b7000000-0000-0000-0000-000000000004', 'Admin Crisis Officer', 'superadmin')
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap;

-- ========================================================
-- HELPER RLS NON-REKURSIF: is_admin() (jika belum ada)
-- ========================================================
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

-- ========================================================
-- SALINAN DDL DARI 20261017000016_client_notes.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.client_notes (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    psikolog_id UUID NOT NULL REFERENCES public.users(id),
    patient_id UUID NOT NULL REFERENCES public.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT client_notes_body_len_check CHECK (pg_catalog.length(body) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_client_notes_psikolog_patient
    ON public.client_notes(psikolog_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_notes_patient
    ON public.client_notes(patient_id);

CREATE INDEX IF NOT EXISTS idx_client_notes_psikolog
    ON public.client_notes(psikolog_id);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_notes_select_psikolog ON public.client_notes;
CREATE POLICY client_notes_select_psikolog ON public.client_notes
    FOR SELECT TO authenticated
    USING (auth.uid() = psikolog_id);

REVOKE INSERT, UPDATE, DELETE ON public.client_notes FROM anon, authenticated;


CREATE TABLE IF NOT EXISTS public.emergency_contact_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id),
    patient_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contact_log_patient
    ON public.emergency_contact_access_log(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_contact_log_admin
    ON public.emergency_contact_access_log(admin_id, created_at DESC);

ALTER TABLE public.emergency_contact_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_contact_log_admin_select ON public.emergency_contact_access_log;
CREATE POLICY emergency_contact_log_admin_select ON public.emergency_contact_access_log
    FOR SELECT TO authenticated
    USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.emergency_contact_access_log FROM anon, authenticated;


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
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.psikolog_id <> p_psikolog_id THEN
        RAISE EXCEPTION 'FORBIDDEN_NOT_BOOKING_PSIKOLOG' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status NOT IN ('in_progress', 'completed') THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    v_trimmed := pg_catalog.btrim(COALESCE(p_body, ''));
    IF pg_catalog.length(v_trimmed) > 5000 THEN
        RAISE EXCEPTION 'BODY_TOO_LONG' USING ERRCODE = 'P0001';
    END IF;

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

REVOKE ALL ON FUNCTION public.client_note_upsert(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_note_upsert(UUID, UUID, TEXT) TO service_role;

-- ========================================================
-- UJI STEP 1: LOGIKA RPC & KENDALI VALIDASI
-- ========================================================
DO $$
DECLARE
    v_booking_id UUID := 'b7000000-0000-0000-0000-000000000101';
    v_note public.client_notes%ROWTYPE;
    v_threw BOOLEAN;
    v_count INTEGER;
BEGIN
    -- 1. Buat booking sesi aktif antara Psikolog A dan Pasien
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, extension_price_coins, refund_policy,
        patient_display_name
    ) VALUES (
        v_booking_id,
        'b7000000-0000-0000-0000-000000000003',
        'b7000000-0000-0000-0000-000000000001',
        pg_catalog.now() - interval '15 minutes',
        'in_progress',
        'Konsultasi kecemasan menjelang ujian akhir.',
        10, 8500, 2, '[]'::jsonb,
        'Rina'
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Psikolog A membuat catatan klinis
    v_note := public.client_note_upsert(
        v_booking_id,
        'b7000000-0000-0000-0000-000000000001',
        'Observasi awal: Pasien menunjukkan tanda panik ringan. Diberikan latihan pernapasan diafragma.'
    );

    ASSERT v_note.booking_id = v_booking_id,
        'UJI 1 GAGAL: booking_id catatan tidak sesuai';
    ASSERT v_note.psikolog_id = 'b7000000-0000-0000-0000-000000000001'::uuid,
        'UJI 1 GAGAL: psikolog_id tidak cocok';
    ASSERT v_note.body LIKE 'Observasi awal%',
        'UJI 1 GAGAL: isi body catatan tidak tersimpan dengan benar';

    -- 2b. Psikolog A memanggil kembali client_note_upsert (update pada booking in_progress) -> tetap 1 baris dengan body baru
    v_note := public.client_note_upsert(
        v_booking_id,
        'b7000000-0000-0000-0000-000000000001',
        'Observasi lanjutan in_progress: Pasien merespons teknik pernapasan dengan baik dan detak jantung stabil.'
    );

    ASSERT v_note.body = 'Observasi lanjutan in_progress: Pasien merespons teknik pernapasan dengan baik dan detak jantung stabil.',
        'UJI 1b GAGAL: body catatan baru pada update in_progress tidak sesuai';

    SELECT count(*) INTO v_count FROM public.client_notes WHERE booking_id = v_booking_id;
    ASSERT v_count = 1,
        format('UJI 1b GAGAL: catatan setelah dipanggil lagi harus tetap 1 baris (ditemukan %s baris)', v_count);

    -- 3. Psikolog B mencoba menulis/mengubah catatan sesi Psikolog A -> WAJIB DITOLAK
    v_threw := false;
    BEGIN
        PERFORM public.client_note_upsert(
            v_booking_id,
            'b7000000-0000-0000-0000-000000000002', -- Psikolog B
            'Mencoba menyusup catatan sesi orang lain'
        );
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
    END;
    ASSERT v_threw = true,
        'UJI 2 GAGAL: Psikolog B seharusnya ditolak saat menulis catatan booking milik Psikolog A';

    -- 4. Status booking 'booked' (belum mulai) -> WAJIB DITOLAK
    UPDATE public.bookings SET status = 'booked' WHERE id = v_booking_id;
    v_threw := false;
    BEGIN
        PERFORM public.client_note_upsert(
            v_booking_id,
            'b7000000-0000-0000-0000-000000000001',
            'Catatan sebelum sesi dimulai'
        );
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
    END;
    ASSERT v_threw = true,
        'UJI 3 GAGAL: Penulisan catatan pada status booked seharusnya ditolak';

    -- 5. Ubah kembali ke status 'completed' dan tes panjang teks > 5000 karakter
    UPDATE public.bookings SET status = 'completed' WHERE id = v_booking_id;
    v_threw := false;
    BEGIN
        PERFORM public.client_note_upsert(
            v_booking_id,
            'b7000000-0000-0000-0000-000000000001',
            repeat('A', 5001)
        );
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
    END;
    ASSERT v_threw = true,
        'UJI 4 GAGAL: Catatan dengan panjang > 5000 karakter seharusnya ditolak';

    -- 6. Update catatan klinis yang valid pada status completed
    v_note := public.client_note_upsert(
        v_booking_id,
        'b7000000-0000-0000-0000-000000000001',
        'Catatan Akhir Sesi: Pasien sudah jauh lebih tenang, rencana tindak lanjut minggu depan.'
    );
    ASSERT v_note.body LIKE 'Catatan Akhir Sesi%',
        'UJI 5 GAGAL: Pembaruan catatan klinis valid gagal';

    -- 7. Catat audit log kontak darurat oleh admin
    INSERT INTO public.emergency_contact_access_log (
        id, admin_id, patient_id
    ) VALUES (
        'b7000000-0000-0000-0000-000000000999',
        'b7000000-0000-0000-0000-000000000004',
        'b7000000-0000-0000-0000-000000000003'
    );

    RAISE NOTICE 'Step 1: Logika RPC & Validasi berhasil diverifikasi.';
END $$;

-- ========================================================
-- UJI STEP 2: TES RLS KETAT
-- ========================================================

-- UJI RLS 1: Psikolog B SELECT client_notes -> WAJIB 0 baris (tidak bisa membaca catatan Psikolog A)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.client_notes;
    ASSERT v_count = 0,
        format('UJI RLS 1 GAGAL: Psikolog B dapat melihat %s baris catatan Psikolog A (harus 0)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 2: Psikolog A SELECT client_notes -> WAJIB melihat 1 baris (catatannya sendiri)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.client_notes;
    ASSERT v_count = 1,
        format('UJI RLS 2 GAGAL: Psikolog A tidak dapat melihat catatannya sendiri (count=%s)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 3: Pasien SELECT client_notes -> WAJIB 0 baris (catatan klinis dirahasiakan dari pasien)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.client_notes;
    ASSERT v_count = 0,
        format('UJI RLS 3 GAGAL: Pasien dapat melihat %s baris catatan klinis (harus 0)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 4: Admin SELECT client_notes -> WAJIB 0 baris (catatan klinis bersifat rahasia psikolog)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.client_notes;
    ASSERT v_count = 0,
        format('UJI RLS 4 GAGAL: Admin dapat melihat %s baris catatan klinis (harus 0)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 5: Non-admin (Psikolog A & Pasien) SELECT emergency_contact_access_log -> WAJIB 0 baris
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.emergency_contact_access_log;
    ASSERT v_count = 0,
        format('UJI RLS 5a GAGAL: Psikolog dapat melihat %s baris log kontak darurat (harus 0)', v_count);
END $$;

RESET ROLE;

DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.emergency_contact_access_log;
    ASSERT v_count = 0,
        format('UJI RLS 5b GAGAL: Pasien dapat melihat %s baris log kontak darurat (harus 0)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 6: Admin SELECT emergency_contact_access_log -> WAJIB melihat baris log audit
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"b7000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.emergency_contact_access_log;
    ASSERT v_count = 1,
        format('UJI RLS 6 GAGAL: Admin tidak dapat melihat log akses kontak darurat (count=%s)', v_count);
END $$;

RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE 'SELURUH UJI DRY-RUN MIGRATION 000016 LULUS SEMPURNA.';
END $$;

ROLLBACK;
