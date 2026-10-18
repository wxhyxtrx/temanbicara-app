-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000019 (PURGE MEDIA SESI)
-- Path: supabase/tests/purge_media_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 1 pasien
-- 2. Setup bookings:
--    - Booking 1 (selesai 40 hari lalu - kadaluwarsa)
--    - Booking 2 (dibatalkan 35 hari lalu - kadaluwarsa)
--    - Booking 3 (selesai 5 hari lalu - sesi baru)
-- 3. Setup pesan media & teks di session_messages:
--    - Pesan media gambar lama (Booking 1)
--    - Pesan media audio/voice lama (Booking 1)
--    - Pesan teks biasa lama (Booking 1)
--    - Pesan media gambar dibatalkan lama (Booking 2)
--    - Pesan media gambar baru (Booking 3)
--    - Pesan media voice baru (Booking 3)
-- 4. DDL RPC session_media_mark_purged(uuid[])
-- 5. Assert:
--    - Identifikasi pesan kadaluwarsa berdasarkan COALESCE(ended_at, cancelled_at) < now() - INTERVAL '30 days'
--    - RPC session_media_mark_purged sukses mengupdate pesan gambar & voice jadi kind='text', body='[media dihapus]', media_path=NULL, duration_seconds=NULL
--    - Constraint chk_session_message_content tidak dilanggar
--    - Pesan teks lama booking 1 tidak berubah
--    - Pesan media booking baru (Booking 3) tidak tersentuh
--    - Idempotensi / pemanggilan RPC dengan array kosong atau NULL aman (return 0)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users & public.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b10_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b10_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'b10_psikolog@temanbicara.test', '081299990101', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b1000000-0000-0000-0000-000000000002', 'b10_pasien@temanbicara.test', '081299990102', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 2. SETUP PROFIL
INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url, spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'Dr. B10 Psikolog, M.Psi', 'SIPP-B10-001', 'https://storage.test/sipp-b10.pdf', ARRAY['Kecemasan'], 5, 150000, false)
ON CONFLICT (user_id) DO UPDATE SET tarif_sesi = EXCLUDED.tarif_sesi, booking_paused = false;

INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b1000000-0000-0000-0000-000000000002', 'Budi Purge Test', 'Budi', 'Ibu Budi', '081100000102', false)
ON CONFLICT (user_id) DO NOTHING;

-- 3. SETUP BOOKINGS
-- Booking 1: Selesai 40 hari lalu (ended_at < now() - 30 days)
INSERT INTO public.bookings (
    id, booking_code, patient_id, psikolog_id, status,
    start_at, end_at, original_start_at,
    price_coins, paid_coins, platform_fee_coins,
    keluhan, created_at, updated_at, ended_at, cancelled_at
) VALUES (
    'b1000000-0000-0000-0000-000000000011', 'TB-B10-001',
    'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'completed',
    pg_catalog.now() - INTERVAL '40 days', pg_catalog.now() - INTERVAL '40 days' + INTERVAL '50 minutes', pg_catalog.now() - INTERVAL '40 days',
    15, 15, 2,
    'Keluhan konsultasi lama booking 1', pg_catalog.now() - INTERVAL '41 days', pg_catalog.now() - INTERVAL '40 days',
    pg_catalog.now() - INTERVAL '40 days' + INTERVAL '50 minutes', NULL
) ON CONFLICT (id) DO NOTHING;

-- Booking 2: Dibatalkan 35 hari lalu (cancelled_at < now() - 30 days)
INSERT INTO public.bookings (
    id, booking_code, patient_id, psikolog_id, status,
    start_at, end_at, original_start_at,
    price_coins, paid_coins, platform_fee_coins,
    keluhan, created_at, updated_at, ended_at, cancelled_at
) VALUES (
    'b1000000-0000-0000-0000-000000000012', 'TB-B10-002',
    'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'cancelled_by_patient',
    pg_catalog.now() - INTERVAL '35 days', pg_catalog.now() - INTERVAL '35 days' + INTERVAL '50 minutes', pg_catalog.now() - INTERVAL '35 days',
    15, 15, 2,
    'Keluhan konsultasi lama booking 2 dibatalkan', pg_catalog.now() - INTERVAL '36 days', pg_catalog.now() - INTERVAL '35 days',
    NULL, pg_catalog.now() - INTERVAL '35 days'
) ON CONFLICT (id) DO NOTHING;

-- Booking 3: Selesai 5 hari lalu (ended_at BARU, belum melewati retensi 30 hari)
INSERT INTO public.bookings (
    id, booking_code, patient_id, psikolog_id, status,
    start_at, end_at, original_start_at,
    price_coins, paid_coins, platform_fee_coins,
    keluhan, created_at, updated_at, ended_at, cancelled_at
) VALUES (
    'b1000000-0000-0000-0000-000000000013', 'TB-B10-003',
    'b1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'completed',
    pg_catalog.now() - INTERVAL '5 days', pg_catalog.now() - INTERVAL '5 days' + INTERVAL '50 minutes', pg_catalog.now() - INTERVAL '5 days',
    15, 15, 2,
    'Keluhan konsultasi sesi baru booking 3', pg_catalog.now() - INTERVAL '6 days', pg_catalog.now() - INTERVAL '5 days',
    pg_catalog.now() - INTERVAL '5 days' + INTERVAL '50 minutes', NULL
) ON CONFLICT (id) DO NOTHING;

-- 4. SETUP PESAN DI SESSION_MESSAGES
-- Booking 1 (lama):
-- Msg 1: image
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000101', 'b1000000-0000-0000-0000-000000000011',
    'b1000000-0000-0000-0000-000000000002', 'image', 'Foto catatan lama', 'b10/old_photo.jpg', NULL,
    pg_catalog.now() - INTERVAL '40 days' + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Msg 2: voice
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000102', 'b1000000-0000-0000-0000-000000000011',
    'b1000000-0000-0000-0000-000000000002', 'voice', NULL, 'b10/old_voice.webm', 42,
    pg_catalog.now() - INTERVAL '40 days' + INTERVAL '10 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Msg 3: text (tidak ada media)
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000103', 'b1000000-0000-0000-0000-000000000011',
    'b1000000-0000-0000-0000-000000000001', 'text', 'Terima kasih, sesi selesai', NULL, NULL,
    pg_catalog.now() - INTERVAL '40 days' + INTERVAL '45 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Booking 2 (dibatalkan lama):
-- Msg 4: image
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000104', 'b1000000-0000-0000-0000-000000000012',
    'b1000000-0000-0000-0000-000000000002', 'image', 'Lampiran bukti cancel', 'b10/cancel_photo.png', NULL,
    pg_catalog.now() - INTERVAL '36 days'
) ON CONFLICT (id) DO NOTHING;

-- Booking 3 (sesi baru):
-- Msg 5: image (baru)
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000105', 'b1000000-0000-0000-0000-000000000013',
    'b1000000-0000-0000-0000-000000000002', 'image', 'Foto tugas kemarin', 'b10/recent_photo.jpg', NULL,
    pg_catalog.now() - INTERVAL '5 days' + INTERVAL '10 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Msg 6: voice (baru)
INSERT INTO public.session_messages (
    id, booking_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'b1000000-0000-0000-0000-000000000106', 'b1000000-0000-0000-0000-000000000013',
    'b1000000-0000-0000-0000-000000000001', 'voice', NULL, 'b10/recent_voice.webm', 25,
    pg_catalog.now() - INTERVAL '5 days' + INTERVAL '20 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- 5. DEFINISI FUNGSI RPC: session_media_mark_purged
-- ========================================================
CREATE OR REPLACE FUNCTION public.session_media_mark_purged(p_message_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_updated_count integer := 0;
BEGIN
    IF p_message_ids IS NULL OR pg_catalog.cardinality(p_message_ids) = 0 THEN
        RETURN 0;
    END IF;

    UPDATE public.session_messages
    SET kind = 'text',
        body = '[media dihapus]',
        media_path = NULL,
        duration_seconds = NULL
    WHERE id = ANY(p_message_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.session_media_mark_purged(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_media_mark_purged(uuid[]) TO service_role;

-- ========================================================
-- 6. PENGUJIAN LOGIKA & ASSERT
-- ========================================================
DO $$
DECLARE
    v_retention_days integer := 30;
    v_stale_msg_ids uuid[];
    v_purged_count integer;
    v_msg_1 public.session_messages%ROWTYPE;
    v_msg_2 public.session_messages%ROWTYPE;
    v_msg_3 public.session_messages%ROWTYPE;
    v_msg_4 public.session_messages%ROWTYPE;
    v_msg_5 public.session_messages%ROWTYPE;
    v_msg_6 public.session_messages%ROWTYPE;
    v_empty_count integer;
BEGIN
    -- UJI 1: Query kandidat pesan media yang bookingnya COALESCE(ended_at, cancelled_at) < now() - 30 days
    SELECT array_agg(sm.id ORDER BY sm.created_at ASC)
    INTO v_stale_msg_ids
    FROM public.session_messages sm
    JOIN public.bookings b ON sm.booking_id = b.id
    WHERE sm.media_path IS NOT NULL
      AND COALESCE(b.ended_at, b.cancelled_at) < (pg_catalog.now() - (v_retention_days * INTERVAL '1 day'))
      AND sm.id IN (
          'b1000000-0000-0000-0000-000000000101',
          'b1000000-0000-0000-0000-000000000102',
          'b1000000-0000-0000-0000-000000000103',
          'b1000000-0000-0000-0000-000000000104',
          'b1000000-0000-0000-0000-000000000105',
          'b1000000-0000-0000-0000-000000000106'
      );

    IF v_stale_msg_ids IS NULL OR pg_catalog.cardinality(v_stale_msg_ids) <> 3 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Diharapkan tepat 3 pesan media kadaluwarsa (msg 1, 2, 4), didapat: %', v_stale_msg_ids;
    END IF;

    IF NOT ('b1000000-0000-0000-0000-000000000101' = ANY(v_stale_msg_ids)) OR
       NOT ('b1000000-0000-0000-0000-000000000102' = ANY(v_stale_msg_ids)) OR
       NOT ('b1000000-0000-0000-0000-000000000104' = ANY(v_stale_msg_ids)) THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Pesan terdeteksi salah, didapat: %', v_stale_msg_ids;
    END IF;

    -- UJI 2: Eksekusi RPC session_media_mark_purged
    v_purged_count := public.session_media_mark_purged(v_stale_msg_ids);
    IF v_purged_count <> 3 THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: session_media_mark_purged harus mengembalikan 3 baris terupdate, didapat: %', v_purged_count;
    END IF;

    -- Ambil status terkini pesan
    SELECT * INTO v_msg_1 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000101';
    SELECT * INTO v_msg_2 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000102';
    SELECT * INTO v_msg_3 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000103';
    SELECT * INTO v_msg_4 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000104';
    SELECT * INTO v_msg_5 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000105';
    SELECT * INTO v_msg_6 FROM public.session_messages WHERE id = 'b1000000-0000-0000-0000-000000000106';

    -- UJI 3: Assert pesan media lama (Msg 1: image) menjadi text '[media dihapus]'
    IF v_msg_1.kind <> 'text' OR v_msg_1.body <> '[media dihapus]' OR v_msg_1.media_path IS NOT NULL OR v_msg_1.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Msg 1 gagal di-purge dengan benar. kind=%, body=%, media_path=%, duration=%',
            v_msg_1.kind, v_msg_1.body, v_msg_1.media_path, v_msg_1.duration_seconds;
    END IF;

    -- UJI 4: Assert pesan media lama (Msg 2: voice) menjadi text '[media dihapus]'
    IF v_msg_2.kind <> 'text' OR v_msg_2.body <> '[media dihapus]' OR v_msg_2.media_path IS NOT NULL OR v_msg_2.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Msg 2 gagal di-purge dengan benar. kind=%, body=%, media_path=%, duration=%',
            v_msg_2.kind, v_msg_2.body, v_msg_2.media_path, v_msg_2.duration_seconds;
    END IF;

    -- UJI 5: Assert pesan media cancelled lama (Msg 4: image) menjadi text '[media dihapus]'
    IF v_msg_4.kind <> 'text' OR v_msg_4.body <> '[media dihapus]' OR v_msg_4.media_path IS NOT NULL OR v_msg_4.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Msg 4 gagal di-purge dengan benar. kind=%, body=%, media_path=%, duration=%',
            v_msg_4.kind, v_msg_4.body, v_msg_4.media_path, v_msg_4.duration_seconds;
    END IF;

    -- UJI 6: Assert pesan teks lama (Msg 3) TIDAK berubah
    IF v_msg_3.kind <> 'text' OR v_msg_3.body <> 'Terima kasih, sesi selesai' OR v_msg_3.media_path IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Msg 3 teks lama tidak boleh berubah. body=%', v_msg_3.body;
    END IF;

    -- UJI 7: Assert pesan media baru booking 3 (Msg 5 & 6) TIDAK TERSENTUH
    IF v_msg_5.kind <> 'image' OR v_msg_5.media_path <> 'b10/recent_photo.jpg' OR v_msg_5.body <> 'Foto tugas kemarin' THEN
        RAISE EXCEPTION 'UJI 7.1 GAGAL: Msg 5 media baru booking 3 tidak boleh tersentuh. kind=%, media_path=%',
            v_msg_5.kind, v_msg_5.media_path;
    END IF;

    IF v_msg_6.kind <> 'voice' OR v_msg_6.media_path <> 'b10/recent_voice.webm' OR v_msg_6.duration_seconds <> 25 THEN
        RAISE EXCEPTION 'UJI 7.2 GAGAL: Msg 6 media voice baru booking 3 tidak boleh tersentuh. kind=%, media_path=%',
            v_msg_6.kind, v_msg_6.media_path;
    END IF;

    -- UJI 8: Assert pemanggilan RPC dengan array kosong atau NULL tidak error
    v_empty_count := public.session_media_mark_purged('{}'::uuid[]);
    IF v_empty_count <> 0 THEN
        RAISE EXCEPTION 'UJI 8.1 GAGAL: Array kosong harus return 0, didapat: %', v_empty_count;
    END IF;

    v_empty_count := public.session_media_mark_purged(NULL);
    IF v_empty_count <> 0 THEN
        RAISE EXCEPTION 'UJI 8.2 GAGAL: NULL array harus return 0, didapat: %', v_empty_count;
    END IF;

    RAISE NOTICE 'SELURUH UJI 1-8 DRY-RUN MIGRATION 000019 SUKSES DIVERIFIKASI';
END $$;

ROLLBACK;
