-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000025 (PURGE MEDIA PEER MESSAGES)
-- Path: supabase/tests/peer_media_purge_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 relawan, 1 pasien (auth.users & public.users)
-- 2. Setup tiket di public.peer_tickets:
--    - Tiket 1 (closed > 30 hari lalu - kadaluwarsa)
--    - Tiket 2 (archived > 30 hari lalu - kadaluwarsa)
--    - Tiket 3 (active / claimed dibuat 35 hari lalu - sesi berjalan)
--    - Tiket 4 (closed 5 hari lalu - belum lewat retensi 30 hari)
-- 3. Setup pesan di public.peer_messages:
--    - Tiket 1: image (msg 1), voice (msg 2), text biasa (msg 3)
--    - Tiket 2: image (msg 4), voice (msg 5)
--    - Tiket 3: image (msg 6), voice (msg 7)
--    - Tiket 4: image (msg 8), voice (msg 9)
-- 4. DDL RPC public.peer_media_mark_purged(uuid[]) & Permissions
-- 5. Assert:
--    - Kasus 1: RPC peer_media_mark_purged berhasil menandai pesan tiket 1 & 2 jadi text '[media dihapus]' (chk_peer_messages_content terpenuhi)
--    - Kasus 2: Pengaman internal RPC menolak pesan pada tiket aktif / claimed (tiket 3)
--    - Kasus 3: Simulasi query cron tidak menjaring tiket closed baru (tiket 4) atau pesan teks
--    - Kasus 4: Idempotensi dan penanganan array kosong / NULL / panggilan berulang (return 0)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP USER TEST: auth.users & public.users
-- ========================================================
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_purge_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_purge_relawan@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('d1000000-0000-0000-0000-000000000001', 'pm_purge_pasien@temanbicara.test', '081277770001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('d1000000-0000-0000-0000-000000000002', 'pm_purge_relawan@temanbicara.test', '081277770002', 'relawan'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- ========================================================
-- 2. SETUP TIKET DI PUBLIC.PEER_TICKETS
-- ========================================================

-- Tiket 1: Closed lewat masa retensi (> 30 hari lalu)
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, created_at, updated_at
) VALUES (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Anon Tiket 1', 'Kecemasan', 'Gelisah', 'Isi cerita tiket 1 closed lama', true,
    'closed'::public.peer_ticket_status,
    'd1000000-0000-0000-0000-000000000002',
    pg_catalog.now() - INTERVAL '36 days',
    pg_catalog.now() - INTERVAL '36 days',
    pg_catalog.now() - INTERVAL '35 days',
    NULL,
    pg_catalog.now() - INTERVAL '36 days',
    pg_catalog.now() - INTERVAL '35 days'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 2: Archived lewat masa retensi (> 30 hari lalu)
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, created_at, updated_at
) VALUES (
    'd2000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001',
    'Anon Tiket 2', 'Stres', 'Lelah', 'Isi cerita tiket 2 archived lama', true,
    'archived'::public.peer_ticket_status,
    NULL,
    NULL,
    NULL,
    NULL,
    pg_catalog.now() - INTERVAL '35 days',
    pg_catalog.now() - INTERVAL '36 days',
    pg_catalog.now() - INTERVAL '35 days'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 3: Active (sesi masih berlangsung)
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, created_at, updated_at
) VALUES (
    'd2000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000001',
    'Anon Tiket 3', 'Karier', 'Bingung', 'Isi cerita tiket 3 aktif', true,
    'active'::public.peer_ticket_status,
    'd1000000-0000-0000-0000-000000000002',
    pg_catalog.now() - INTERVAL '35 days',
    pg_catalog.now() - INTERVAL '35 days',
    NULL,
    NULL,
    pg_catalog.now() - INTERVAL '35 days',
    pg_catalog.now() - INTERVAL '35 days'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 4: Closed baru (< 30 hari, misal 5 hari lalu)
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content, is_anonymous,
    status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, created_at, updated_at
) VALUES (
    'd2000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000001',
    'Anon Tiket 4', 'Keluarga', 'Sedih', 'Isi cerita tiket 4 closed baru', true,
    'closed'::public.peer_ticket_status,
    'd1000000-0000-0000-0000-000000000002',
    pg_catalog.now() - INTERVAL '6 days',
    pg_catalog.now() - INTERVAL '6 days',
    pg_catalog.now() - INTERVAL '5 days',
    NULL,
    pg_catalog.now() - INTERVAL '6 days',
    pg_catalog.now() - INTERVAL '5 days'
) ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- 3. SETUP PESAN DI PUBLIC.PEER_MESSAGES
-- ========================================================

-- Tiket 1 (closed lama):
-- Msg 1: image
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001', 'image', 'Foto sesi t1', 'peer/d2000000-0000-0000-0000-000000000001/img1.jpg', NULL,
    pg_catalog.now() - INTERVAL '36 days'
) ON CONFLICT (id) DO NOTHING;

-- Msg 2: voice
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001', 'voice', NULL, 'peer/d2000000-0000-0000-0000-000000000001/voice1.webm', 30,
    pg_catalog.now() - INTERVAL '36 days' + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Msg 3: text (tanpa berkas media)
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002', 'text', 'Pesan teks biasa t1', NULL, NULL,
    pg_catalog.now() - INTERVAL '36 days' + INTERVAL '10 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 2 (archived lama):
-- Msg 4: image
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001', 'image', 'Foto sesi t2', 'peer/d2000000-0000-0000-0000-000000000002/img2.png', NULL,
    pg_catalog.now() - INTERVAL '36 days'
) ON CONFLICT (id) DO NOTHING;

-- Msg 5: voice
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001', 'voice', NULL, 'peer/d2000000-0000-0000-0000-000000000002/voice2.webm', 45,
    pg_catalog.now() - INTERVAL '36 days' + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 3 (active):
-- Msg 6: image
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000006', 'd2000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000001', 'image', 'Foto t3 aktif', 'peer/d2000000-0000-0000-0000-000000000003/img3.jpg', NULL,
    pg_catalog.now() - INTERVAL '35 days'
) ON CONFLICT (id) DO NOTHING;

-- Msg 7: voice
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000007', 'd2000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000001', 'voice', NULL, 'peer/d2000000-0000-0000-0000-000000000003/voice3.webm', 20,
    pg_catalog.now() - INTERVAL '35 days' + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Tiket 4 (closed baru):
-- Msg 8: image
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000008', 'd2000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000001', 'image', 'Foto t4 baru', 'peer/d2000000-0000-0000-0000-000000000004/img4.jpg', NULL,
    pg_catalog.now() - INTERVAL '5 days'
) ON CONFLICT (id) DO NOTHING;

-- Msg 9: voice
INSERT INTO public.peer_messages (
    id, ticket_id, sender_id, kind, body, media_path, duration_seconds, created_at
) VALUES (
    'd3000000-0000-0000-0000-000000000009', 'd2000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000001', 'voice', NULL, 'peer/d2000000-0000-0000-0000-000000000004/voice4.webm', 15,
    pg_catalog.now() - INTERVAL '5 days' + INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- 4. DDL RPC PEER_MEDIA_MARK_PURGED & PERMISSIONS
-- ========================================================
CREATE OR REPLACE FUNCTION public.peer_media_mark_purged(p_message_ids uuid[])
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

    UPDATE public.peer_messages m
    SET kind = 'text',
        body = '[media dihapus]',
        media_path = NULL,
        duration_seconds = NULL
    FROM public.peer_tickets t
    WHERE m.id = ANY(p_message_ids)
      AND m.ticket_id = t.id
      AND m.media_path IS NOT NULL
      AND t.status IN ('closed', 'archived');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.peer_media_mark_purged(uuid[]) IS 'Menandai pesan curhat sebaya sebagai terhapus medianya setelah berkas fisik dihapus dari storage';

REVOKE ALL ON FUNCTION public.peer_media_mark_purged(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_media_mark_purged(uuid[]) TO service_role;

-- ========================================================
-- 5. PENGUJIAN LOGIKA & ASSERT
-- ========================================================
DO $$
DECLARE
    v_retention_days integer := 30;
    v_candidate_ids uuid[];
    v_purged_count integer;
    v_msg_1 public.peer_messages%ROWTYPE;
    v_msg_2 public.peer_messages%ROWTYPE;
    v_msg_3 public.peer_messages%ROWTYPE;
    v_msg_4 public.peer_messages%ROWTYPE;
    v_msg_5 public.peer_messages%ROWTYPE;
    v_msg_6 public.peer_messages%ROWTYPE;
    v_msg_7 public.peer_messages%ROWTYPE;
    v_msg_8 public.peer_messages%ROWTYPE;
    v_msg_9 public.peer_messages%ROWTYPE;
    v_active_purged integer;
    v_empty_count integer;
    v_null_count integer;
    v_repurge_count integer;
BEGIN
    -- ----------------------------------------------------
    -- KASUS 3 / PRE-CHECK: Verifikasi simulasi query cron
    -- ----------------------------------------------------
    -- Hanya pesan ber-media_path dari tiket closed/archived > 30 hari yang terpilih
    SELECT array_agg(m.id ORDER BY m.id ASC)
    INTO v_candidate_ids
    FROM public.peer_messages m
    JOIN public.peer_tickets t ON m.ticket_id = t.id
    WHERE m.media_path IS NOT NULL
      AND t.status IN ('closed', 'archived')
      AND COALESCE(t.closed_at, t.archived_at) < (pg_catalog.now() - (v_retention_days * INTERVAL '1 day'))
      AND m.id IN (
          'd3000000-0000-0000-0000-000000000001',
          'd3000000-0000-0000-0000-000000000002',
          'd3000000-0000-0000-0000-000000000003',
          'd3000000-0000-0000-0000-000000000004',
          'd3000000-0000-0000-0000-000000000005',
          'd3000000-0000-0000-0000-000000000006',
          'd3000000-0000-0000-0000-000000000007',
          'd3000000-0000-0000-0000-000000000008',
          'd3000000-0000-0000-0000-000000000009'
      );

    IF v_candidate_ids IS NULL OR pg_catalog.cardinality(v_candidate_ids) <> 4 THEN
        RAISE EXCEPTION 'UJI KANDIDAT GAGAL: Diharapkan tepat 4 pesan media kadaluwarsa (msg 1, 2, 4, 5), didapat: %', v_candidate_ids;
    END IF;

    IF NOT ('d3000000-0000-0000-0000-000000000001' = ANY(v_candidate_ids)) OR
       NOT ('d3000000-0000-0000-0000-000000000002' = ANY(v_candidate_ids)) OR
       NOT ('d3000000-0000-0000-0000-000000000004' = ANY(v_candidate_ids)) OR
       NOT ('d3000000-0000-0000-0000-000000000005' = ANY(v_candidate_ids)) THEN
        RAISE EXCEPTION 'UJI KANDIDAT GAGAL: Pesan yang terpilih tidak sesuai target: %', v_candidate_ids;
    END IF;

    -- Tiket 3 (active) dan Tiket 4 (closed baru) serta msg 3 (teks) tidak boleh ada di kandidat
    IF ('d3000000-0000-0000-0000-000000000003' = ANY(v_candidate_ids)) OR
       ('d3000000-0000-0000-0000-000000000006' = ANY(v_candidate_ids)) OR
       ('d3000000-0000-0000-0000-000000000007' = ANY(v_candidate_ids)) OR
       ('d3000000-0000-0000-0000-000000000008' = ANY(v_candidate_ids)) OR
       ('d3000000-0000-0000-0000-000000000009' = ANY(v_candidate_ids)) THEN
        RAISE EXCEPTION 'UJI KANDIDAT GAGAL: Pesan non-kadaluwarsa / teks terikut dalam kandidat purge';
    END IF;

    -- ----------------------------------------------------
    -- KASUS 1: RPC peer_media_mark_purged berhasil menandai pesan tiket 1 dan tiket 2
    -- ----------------------------------------------------
    v_purged_count := public.peer_media_mark_purged(v_candidate_ids);
    IF v_purged_count <> 4 THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: peer_media_mark_purged harus mengembalikan 4 baris terupdate, didapat: %', v_purged_count;
    END IF;

    SELECT * INTO v_msg_1 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000001';
    SELECT * INTO v_msg_2 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000002';
    SELECT * INTO v_msg_3 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000003';
    SELECT * INTO v_msg_4 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000004';
    SELECT * INTO v_msg_5 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000005';

    -- Verifikasi msg 1 (image -> text '[media dihapus]')
    IF v_msg_1.kind <> 'text' OR v_msg_1.body <> '[media dihapus]' OR v_msg_1.media_path IS NOT NULL OR v_msg_1.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: Msg 1 tidak ditandai dengan benar: kind=%, body=%, media_path=%, duration=%',
            v_msg_1.kind, v_msg_1.body, v_msg_1.media_path, v_msg_1.duration_seconds;
    END IF;

    -- Verifikasi msg 2 (voice -> text '[media dihapus]')
    IF v_msg_2.kind <> 'text' OR v_msg_2.body <> '[media dihapus]' OR v_msg_2.media_path IS NOT NULL OR v_msg_2.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: Msg 2 tidak ditandai dengan benar: kind=%, body=%, media_path=%, duration=%',
            v_msg_2.kind, v_msg_2.body, v_msg_2.media_path, v_msg_2.duration_seconds;
    END IF;

    -- Verifikasi msg 4 (image archived -> text '[media dihapus]')
    IF v_msg_4.kind <> 'text' OR v_msg_4.body <> '[media dihapus]' OR v_msg_4.media_path IS NOT NULL OR v_msg_4.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: Msg 4 tidak ditandai dengan benar: kind=%, body=%, media_path=%, duration=%',
            v_msg_4.kind, v_msg_4.body, v_msg_4.media_path, v_msg_4.duration_seconds;
    END IF;

    -- Verifikasi msg 5 (voice archived -> text '[media dihapus]')
    IF v_msg_5.kind <> 'text' OR v_msg_5.body <> '[media dihapus]' OR v_msg_5.media_path IS NOT NULL OR v_msg_5.duration_seconds IS NOT NULL THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: Msg 5 tidak ditandai dengan benar: kind=%, body=%, media_path=%, duration=%',
            v_msg_5.kind, v_msg_5.body, v_msg_5.media_path, v_msg_5.duration_seconds;
    END IF;

    -- Verifikasi msg 3 (pesan teks pada tiket 1 TIDAK berubah)
    IF v_msg_3.kind <> 'text' OR v_msg_3.body <> 'Pesan teks biasa t1' OR v_msg_3.media_path IS NOT NULL THEN
        RAISE EXCEPTION 'KASUS 1 GAGAL: Msg 3 teks biasa tidak boleh berubah: body=%', v_msg_3.body;
    END IF;

    -- ----------------------------------------------------
    -- KASUS 2: Pengaman internal RPC terhadap tiket aktif / claimed
    -- ----------------------------------------------------
    -- Mengirim ID pesan dari tiket 3 (active) ke RPC wajib diabaikan (return 0)
    v_active_purged := public.peer_media_mark_purged(ARRAY[
        'd3000000-0000-0000-0000-000000000006'::uuid,
        'd3000000-0000-0000-0000-000000000007'::uuid
    ]);
    IF v_active_purged <> 0 THEN
        RAISE EXCEPTION 'KASUS 2 GAGAL: Pesan pada tiket aktif tidak boleh diupdate oleh RPC, didapat: %', v_active_purged;
    END IF;

    SELECT * INTO v_msg_6 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000006';
    SELECT * INTO v_msg_7 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000007';

    IF v_msg_6.kind <> 'image' OR v_msg_6.media_path <> 'peer/d2000000-0000-0000-0000-000000000003/img3.jpg' OR v_msg_6.body <> 'Foto t3 aktif' THEN
        RAISE EXCEPTION 'KASUS 2 GAGAL: Msg 6 tiket aktif termodifikasi secara tidak sah';
    END IF;
    IF v_msg_7.kind <> 'voice' OR v_msg_7.media_path <> 'peer/d2000000-0000-0000-0000-000000000003/voice3.webm' OR v_msg_7.duration_seconds <> 20 THEN
        RAISE EXCEPTION 'KASUS 2 GAGAL: Msg 7 tiket aktif termodifikasi secara tidak sah';
    END IF;

    -- Verifikasi pesan tiket 4 (closed baru) juga tetap utuh
    SELECT * INTO v_msg_8 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000008';
    SELECT * INTO v_msg_9 FROM public.peer_messages WHERE id = 'd3000000-0000-0000-0000-000000000009';
    IF v_msg_8.kind <> 'image' OR v_msg_8.media_path <> 'peer/d2000000-0000-0000-0000-000000000004/img4.jpg' THEN
        RAISE EXCEPTION 'KASUS 3 GAGAL: Msg 8 tiket closed baru termodifikasi';
    END IF;
    IF v_msg_9.kind <> 'voice' OR v_msg_9.media_path <> 'peer/d2000000-0000-0000-0000-000000000004/voice4.webm' THEN
        RAISE EXCEPTION 'KASUS 3 GAGAL: Msg 9 tiket closed baru termodifikasi';
    END IF;

    -- ----------------------------------------------------
    -- KASUS 4: Idempotensi dan penanganan array kosong / NULL
    -- ----------------------------------------------------
    v_empty_count := public.peer_media_mark_purged('{}'::uuid[]);
    IF v_empty_count <> 0 THEN
        RAISE EXCEPTION 'KASUS 4.1 GAGAL: Array kosong harus return 0, didapat: %', v_empty_count;
    END IF;

    v_null_count := public.peer_media_mark_purged(NULL);
    IF v_null_count <> 0 THEN
        RAISE EXCEPTION 'KASUS 4.2 GAGAL: NULL array harus return 0, didapat: %', v_null_count;
    END IF;

    -- Panggilan berulang pada kandidat yang sudah di-purge (media_path sudah NULL) wajib return 0
    v_repurge_count := public.peer_media_mark_purged(v_candidate_ids);
    IF v_repurge_count <> 0 THEN
        RAISE EXCEPTION 'KASUS 4.3 GAGAL: Pemanggilan ulang pada pesan yang sudah dipurge harus return 0, didapat: %', v_repurge_count;
    END IF;

    RAISE NOTICE 'SELURUH SKENARIO UJI DRY-RUN PEER MEDIA PURGE BERHASIL DIVERIFIKASI (KASUS 1 - 4)';
END $$;

ROLLBACK;
