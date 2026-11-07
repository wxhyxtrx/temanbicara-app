-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 20261107000036 (CRISIS FEED & DETEKSI KRISIS)
-- Path: supabase/tests/crisis_feed_dryrun.sql
-- Scope:
-- 1. Setup fixture: auth.users, public.users, bookings, peer_tickets, notifications
-- 2. DDL Salinan persis dari 20261107000036_crisis_feed.sql:
--    - Tabel public.crisis_alerts, RLS & hak akses service_role
--    - Kolom alert_id pada public.emergency_contact_access_log
--    - Fungsi SECURITY DEFINER public.trg_detect_crisis_keyword()
--    - Trigger trg_session_messages_crisis dan trg_peer_messages_crisis
-- 3. Uji 1: Deteksi Pesan Krisis Pasien pada session_messages (alert baru 'new', hit_count=1, notif admin, psikolog, pasien)
-- 4. Uji 2: Aturan 1 Alert Terbuka (hit kedua menaikkan hit_count=2, tanpa alert baru, tanpa notifikasi ganda)
-- 5. Uji 3: Pengabaian Pesan Non-Pasien & Non-Krisis (pesan normal pasien, pesan krisis psikolog, pesan media)
-- 6. Uji 4: Deteksi Pesan Krisis Pasien pada peer_messages (alert baru 'new' source peer_ticket, hit kedua hit_count=2, relawan diabaikan)
-- 7. Uji 5: Isolasi RLS crisis_alerts menolak akses anon dan authenticated (error 42501)
-- 8. Uji 6: Kolom alert_id pada emergency_contact_access_log & validasi foreign key
-- 9. Uji 7: Sifat Non-blocking Fail-Safe Trigger (kegagalan internal trigger tidak menggagalkan insert pesan chat)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP FIXTURE: USERS, PROFILES, BOOKING & PEER TICKET
-- ========================================================

-- Setup auth.users
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('c3600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm_crisis@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c3600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'psi_crisis@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c3600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rel_crisis@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c3600000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pas_crisis@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Setup public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('c3600000-0000-0000-0000-000000000001', 'adm_crisis@temanbicara.test', '081277770001', 'admin'::public.user_role, 'active'::public.account_status),
    ('c3600000-0000-0000-0000-000000000002', 'psi_crisis@temanbicara.test', '081277770002', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('c3600000-0000-0000-0000-000000000003', 'rel_crisis@temanbicara.test', '081277770003', 'relawan'::public.user_role, 'active'::public.account_status),
    ('c3600000-0000-0000-0000-000000000004', 'pas_crisis@temanbicara.test', '081277770004', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Setup profil pasien
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('c3600000-0000-0000-0000-000000000004', 'Pasien Uji Krisis', 'Budi', 'Ibu Budi', '081199990004', false)
ON CONFLICT (user_id) DO NOTHING;

-- Setup profil psikolog
INSERT INTO public.psikolog_profiles (user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url, spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused)
VALUES
    ('c3600000-0000-0000-0000-000000000002', 'Dr. Psikolog Krisis, M.Psi', 'SIPP-C36-001', 'https://storage.test/sipp.pdf', ARRAY['Krisis Klinis'], 10, 150000, false)
ON CONFLICT (user_id) DO NOTHING;

-- Setup profil relawan
INSERT INTO public.relawan_profiles (user_id, nama_lengkap, alias_name, latar_belakang, alasan_bergabung, total_sesi, is_available, topik_keahlian)
VALUES
    ('c3600000-0000-0000-0000-000000000003', 'Relawan Krisis Uji', 'Kak Bintang', 'Konseling Sebaya', 'Peduli sesama', 5, true, ARRAY['Stres', 'Kecemasan'])
ON CONFLICT (user_id) DO NOTHING;

-- Setup booking konseling
INSERT INTO public.bookings (
    id, patient_id, psikolog_id, start_at, status, keluhan,
    price_coins, mitra_share_bps, refund_policy, patient_display_name
) VALUES (
    'c3600000-0000-0000-0000-000000000010',
    'c3600000-0000-0000-0000-000000000004',
    'c3600000-0000-0000-0000-000000000002',
    pg_catalog.now() - interval '10 minutes',
    'in_progress',
    'Keluhan konseling klinis untuk pengujian deteksi krisis keselamatan pasien...',
    15, 8000, '[]'::jsonb,
    'Budi Pasien'
) ON CONFLICT (id) DO NOTHING;

-- Setup tiket curhat sebaya
INSERT INTO public.peer_tickets (
    id, patient_id, patient_alias, topic, emotion, content,
    is_anonymous, status, claimed_by, claimed_at
) VALUES (
    'c3600000-0000-0000-0000-000000000020',
    'c3600000-0000-0000-0000-000000000004',
    'Bunga Lily',
    'Kecemasan',
    'Gelisah',
    'Cerita curhat sebaya untuk pengujian deteksi krisis Ruang Dengar...',
    true,
    'active'::public.peer_ticket_status,
    'c3600000-0000-0000-0000-000000000003',
    pg_catalog.now() - interval '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- 2. DDL MIGRATION: 20261107000036_crisis_feed.sql
-- ========================================================

-- A. Tabel crisis_alerts
CREATE TABLE IF NOT EXISTS public.crisis_alerts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('booking', 'peer_ticket')),
    booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    ticket_id UUID NULL REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    detected_by TEXT NOT NULL CHECK (detected_by IN ('keyword', 'manual')),
    reporter_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'self_harm_risk',
    snippet TEXT NULL CHECK (snippet IS NULL OR pg_catalog.char_length(snippet) <= 100),
    hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 1),
    status TEXT NOT NULL CHECK (status IN ('new', 'handled', 'false_alarm')) DEFAULT 'new',
    handled_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ NULL,
    admin_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_crisis_alerts_target CHECK (
        (source = 'booking' AND booking_id IS NOT NULL AND ticket_id IS NULL) OR
        (source = 'peer_ticket' AND ticket_id IS NOT NULL AND booking_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_crisis_alerts_status_created ON public.crisis_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_booking ON public.crisis_alerts (booking_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_ticket ON public.crisis_alerts (ticket_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_patient ON public.crisis_alerts (patient_id);

ALTER TABLE public.crisis_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crisis_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crisis_alerts TO service_role;

-- B. Kolom audit log emergency_contact_access_log
ALTER TABLE public.emergency_contact_access_log
    ADD COLUMN IF NOT EXISTS alert_id UUID NULL REFERENCES public.crisis_alerts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_contact_access_log_alert
    ON public.emergency_contact_access_log (alert_id) WHERE alert_id IS NOT NULL;

-- C. Trigger deteksi kata kunci otomatis
CREATE OR REPLACE FUNCTION public.trg_detect_crisis_keyword()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_table TEXT;
    v_source TEXT;
    v_booking_id UUID;
    v_ticket_id UUID;
    v_patient_id UUID;
    v_companion_id UUID;
    v_body_lower TEXT;
    v_matched BOOLEAN := FALSE;
    v_snippet TEXT;
    v_existing_alert_id UUID;
    v_alert_id UUID;
    r_admin RECORD;
BEGIN
    IF NEW.kind IS DISTINCT FROM 'text' OR NEW.body IS NULL OR pg_catalog.btrim(NEW.body) = '' THEN
        RETURN NEW;
    END IF;

    BEGIN
        v_table := pg_catalog.lower(TG_TABLE_NAME);

        IF v_table = 'session_messages' THEN
            v_source := 'booking';
            v_booking_id := NEW.booking_id;
            v_ticket_id := NULL;

            SELECT b.patient_id, b.psikolog_id
            INTO v_patient_id, v_companion_id
            FROM public.bookings b
            WHERE b.id = NEW.booking_id;

            IF v_patient_id IS NULL OR NEW.sender_id IS DISTINCT FROM v_patient_id THEN
                RETURN NEW;
            END IF;

        ELSIF v_table = 'peer_messages' THEN
            v_source := 'peer_ticket';
            v_booking_id := NULL;
            v_ticket_id := NEW.ticket_id;

            SELECT t.patient_id, t.claimed_by
            INTO v_patient_id, v_companion_id
            FROM public.peer_tickets t
            WHERE t.id = NEW.ticket_id;

            IF v_patient_id IS NULL OR NEW.sender_id IS DISTINCT FROM v_patient_id THEN
                RETURN NEW;
            END IF;

        ELSE
            RETURN NEW;
        END IF;

        v_body_lower := pg_catalog.lower(NEW.body);

        IF v_body_lower LIKE '%bunuh diri%' OR
           v_body_lower LIKE '%ingin mati%' OR
           v_body_lower LIKE '%mengakhiri hidup%' OR
           v_body_lower LIKE '%menyakiti diri%' OR
           v_body_lower LIKE '%self harm%' OR
           v_body_lower LIKE '%tidak ingin hidup%' OR
           v_body_lower LIKE '%mau mati%' OR
           v_body_lower LIKE '%akhiri hidup%' THEN
            v_matched := TRUE;
        END IF;

        IF NOT v_matched THEN
            RETURN NEW;
        END IF;

        v_snippet := pg_catalog.substring(NEW.body FROM 1 FOR 100);

        IF v_source = 'booking' THEN
            SELECT id INTO v_existing_alert_id
            FROM public.crisis_alerts
            WHERE booking_id = v_booking_id AND status = 'new'
            ORDER BY created_at DESC
            LIMIT 1;
        ELSE
            SELECT id INTO v_existing_alert_id
            FROM public.crisis_alerts
            WHERE ticket_id = v_ticket_id AND status = 'new'
            ORDER BY created_at DESC
            LIMIT 1;
        END IF;

        IF v_existing_alert_id IS NOT NULL THEN
            UPDATE public.crisis_alerts
            SET hit_count = hit_count + 1
            WHERE id = v_existing_alert_id;
        ELSE
            INSERT INTO public.crisis_alerts (
                source,
                booking_id,
                ticket_id,
                patient_id,
                detected_by,
                reporter_id,
                category,
                snippet,
                hit_count,
                status,
                created_at
            ) VALUES (
                v_source,
                v_booking_id,
                v_ticket_id,
                v_patient_id,
                'keyword',
                NULL,
                'self_harm_risk',
                v_snippet,
                1,
                'new',
                pg_catalog.now()
            )
            RETURNING id INTO v_alert_id;

            -- 1. Notifikasi ke seluruh admin aktif
            FOR r_admin IN
                SELECT u.id
                FROM public.users u
                WHERE u.role = 'admin'::public.user_role
                  AND u.status = 'active'::public.account_status
            LOOP
                PERFORM public.notify_internal(
                    r_admin.id,
                    'crisis_alert',
                    'Peringatan Krisis Pasien',
                    'Terdeteksi indikasi krisis keselamatan diri pasien yang membutuhkan penanganan segera.',
                    '/admin/crisis-feed'
                );
            END LOOP;

            -- 2. Notifikasi ke pendamping sesi (tanpa snippet)
            IF v_companion_id IS NOT NULL THEN
                PERFORM public.notify_internal(
                    v_companion_id,
                    'crisis_companion_alert',
                    'Peringatan Keselamatan Pasien',
                    'Pasien Anda mungkin membutuhkan perhatian dan pendampingan khusus saat ini. Utamakan keselamatan dan dengarkan dengan penuh empati.',
                    CASE
                        WHEN v_source = 'booking' THEN '/counselor/room?booking=' || v_booking_id::text
                        ELSE '/listener/room/' || v_ticket_id::text
                    END
                );
            END IF;

            -- 3. Notifikasi ke pasien (berisi info hotline 119 ext 8 & 112)
            PERFORM public.notify_internal(
                v_patient_id,
                'crisis_support',
                'Bantuan Selalu Ada Untukmu',
                'Kamu tidak sendirian. Jika butuh bantuan segera, hubungi hotline darurat 119 ext 8 (Pencegahan Bunuh Diri) atau 112 (Panggilan Darurat). Kami peduli padamu.',
                NULL
            );
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_detect_crisis_keyword() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_detect_crisis_keyword() TO service_role;

DROP TRIGGER IF EXISTS trg_session_messages_crisis ON public.session_messages;
CREATE TRIGGER trg_session_messages_crisis
    AFTER INSERT ON public.session_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_detect_crisis_keyword();

DROP TRIGGER IF EXISTS trg_peer_messages_crisis ON public.peer_messages;
CREATE TRIGGER trg_peer_messages_crisis
    AFTER INSERT ON public.peer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_detect_crisis_keyword();

-- ========================================================
-- 3. UJI 1: DETEKSI PESAN KRISIS PASIEN PADA SESSION_MESSAGES
-- ========================================================
DO $$
DECLARE
    v_alert public.crisis_alerts%ROWTYPE;
    v_admin_notif_count INTEGER;
    v_psi_notif_count INTEGER;
    v_pas_notif_count INTEGER;
    v_psi_notif public.notifications%ROWTYPE;
    v_pas_notif public.notifications%ROWTYPE;
BEGIN
    -- Pasien mengirim pesan krisis pertama
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'saya merasa sangat lelah dan ingin mengakhiri hidup'
    );

    -- Verifikasi baris crisis_alerts terbentuk
    SELECT * INTO v_alert
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010'
      AND status = 'new';

    ASSERT v_alert.id IS NOT NULL, 'UJI 1.1 GAGAL: Baris crisis_alerts tidak terbentuk pada hit krisis pertama';
    ASSERT v_alert.source = 'booking', 'UJI 1.2 GAGAL: Kolom source harus "booking"';
    ASSERT v_alert.patient_id = 'c3600000-0000-0000-0000-000000000004', 'UJI 1.3 GAGAL: patient_id tidak cocok';
    ASSERT v_alert.detected_by = 'keyword', 'UJI 1.4 GAGAL: detected_by harus "keyword"';
    ASSERT v_alert.hit_count = 1, format('UJI 1.5 GAGAL: hit_count awal harus 1, didapat: %s', v_alert.hit_count);
    ASSERT v_alert.snippet = 'saya merasa sangat lelah dan ingin mengakhiri hidup', 'UJI 1.6 GAGAL: Snippet tidak cocok';

    -- Verifikasi notifikasi terkirim ke admin aktif
    SELECT count(*) INTO v_admin_notif_count
    FROM public.notifications
    WHERE user_id = 'c3600000-0000-0000-0000-000000000001'
      AND type = 'crisis_alert'
      AND link = '/admin/crisis-feed';

    ASSERT v_admin_notif_count >= 1, 'UJI 1.7 GAGAL: Admin aktif tidak menerima notifikasi crisis_alert';

    -- Verifikasi notifikasi terkirim ke psikolog pendamping (tanpa snippet)
    SELECT * INTO v_psi_notif
    FROM public.notifications
    WHERE user_id = 'c3600000-0000-0000-0000-000000000002'
      AND type = 'crisis_companion_alert'
    ORDER BY created_at DESC
    LIMIT 1;

    ASSERT v_psi_notif.id IS NOT NULL, 'UJI 1.8 GAGAL: Pendamping tidak menerima notifikasi crisis_companion_alert';
    ASSERT v_psi_notif.body NOT LIKE '%mengakhiri hidup%', 'UJI 1.9 GAGAL: Snippet bocor pada notifikasi pendamping';

    -- Verifikasi notifikasi terkirim ke pasien berisi hotline 119 ext 8 & 112
    SELECT * INTO v_pas_notif
    FROM public.notifications
    WHERE user_id = 'c3600000-0000-0000-0000-000000000004'
      AND type = 'crisis_support'
    ORDER BY created_at DESC
    LIMIT 1;

    ASSERT v_pas_notif.id IS NOT NULL, 'UJI 1.10 GAGAL: Pasien tidak menerima notifikasi crisis_support';
    ASSERT v_pas_notif.body LIKE '%119 ext 8%' AND v_pas_notif.body LIKE '%112%',
        'UJI 1.11 GAGAL: Notifikasi pasien wajib memuat nomor hotline darurat 119 ext 8 dan 112';
END $$;

-- ========================================================
-- 4. UJI 2: ATURAN 1 ALERT TERBUKA (HIT KEDUA MENAIKKAN HIT_COUNT)
-- ========================================================
DO $$
DECLARE
    v_alert_count INTEGER;
    v_alert public.crisis_alerts%ROWTYPE;
    v_admin_notif_before INTEGER;
    v_admin_notif_after INTEGER;
BEGIN
    SELECT count(*) INTO v_admin_notif_before
    FROM public.notifications
    WHERE type = 'crisis_alert';

    -- Pasien mengirim pesan krisis kedua pada sesi yang sama
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'tolong saya mau mati saja sekarang'
    );

    -- Verifikasi jumlah baris alert tetap 1 (tidak membuat baris baru)
    SELECT count(*) INTO v_alert_count
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010';

    ASSERT v_alert_count = 1, format('UJI 2.1 GAGAL: Harus tetap 1 alert per booking, didapat: %s', v_alert_count);

    -- Verifikasi hit_count naik menjadi 2
    SELECT * INTO v_alert
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010';

    ASSERT v_alert.hit_count = 2, format('UJI 2.2 GAGAL: hit_count harus naik menjadi 2, didapat: %s', v_alert.hit_count);

    -- Verifikasi tidak ada notifikasi dobel
    SELECT count(*) INTO v_admin_notif_after
    FROM public.notifications
    WHERE type = 'crisis_alert';

    ASSERT v_admin_notif_after = v_admin_notif_before,
        format('UJI 2.3 GAGAL: Hit kedua tidak boleh memicu notifikasi ulang (sebelum: %s, sesudah: %s)',
            v_admin_notif_before, v_admin_notif_after);
END $$;

-- ========================================================
-- 5. UJI 3: PENGABAIAN PESAN NON-PASIEN & NON-KRISIS
-- ========================================================
DO $$
DECLARE
    v_hit_count INTEGER;
    v_alert_count INTEGER;
BEGIN
    -- 3a: Pesan teks pasien tanpa kata kunci krisis
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'halo dok terima kasih sarannya sangat membantu'
    );

    SELECT hit_count INTO v_hit_count
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010';

    ASSERT v_hit_count = 2, 'UJI 3.1 GAGAL: Pesan non-krisis tidak boleh menaikkan hit_count';

    -- 3b: Pesan memuat kata kunci krisis tetapi dikirim oleh Psikolog (non-pasien)
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000002',
        'text',
        'apakah kamu ada pikiran ingin bunuh diri atau menyakiti diri sebelumnya?'
    );

    SELECT hit_count INTO v_hit_count
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010';

    ASSERT v_hit_count = 2, 'UJI 3.2 GAGAL: Pesan krisis dari pendamping (psikolog) wajib diabaikan trigger';

    -- 3c: Pesan non-teks (image)
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, media_path
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000004',
        'image',
        'session-media/bukti.png'
    );

    SELECT hit_count INTO v_hit_count
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010';

    ASSERT v_hit_count = 2, 'UJI 3.3 GAGAL: Pesan media gambar tidak boleh menaikkan hit_count';
END $$;

-- ========================================================
-- 6. UJI 4: DETEKSI PESAN KRISIS PASIEN PADA PEER_MESSAGES
-- ========================================================
DO $$
DECLARE
    v_alert public.crisis_alerts%ROWTYPE;
    v_alert_count INTEGER;
    v_rel_notif_count INTEGER;
BEGIN
    -- Pasien mengirim pesan krisis pertama di Ruang Dengar
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000020',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'aku rasanya mau self harm malam ini'
    );

    -- Verifikasi baris crisis_alerts terbentuk dengan source peer_ticket
    SELECT * INTO v_alert
    FROM public.crisis_alerts
    WHERE ticket_id = 'c3600000-0000-0000-0000-000000000020'
      AND status = 'new';

    ASSERT v_alert.id IS NOT NULL, 'UJI 4.1 GAGAL: Baris crisis_alerts tidak terbentuk pada peer_messages';
    ASSERT v_alert.source = 'peer_ticket', 'UJI 4.2 GAGAL: Kolom source harus "peer_ticket"';
    ASSERT v_alert.booking_id IS NULL, 'UJI 4.3 GAGAL: booking_id wajib NULL untuk source peer_ticket';
    ASSERT v_alert.hit_count = 1, 'UJI 4.4 GAGAL: hit_count awal peer_ticket harus 1';

    -- Verifikasi notifikasi terkirim ke relawan pendamping
    SELECT count(*) INTO v_rel_notif_count
    FROM public.notifications
    WHERE user_id = 'c3600000-0000-0000-0000-000000000003'
      AND type = 'crisis_companion_alert';

    ASSERT v_rel_notif_count >= 1, 'UJI 4.5 GAGAL: Relawan pendamping tidak menerima notifikasi';

    -- Pasien mengirim pesan krisis kedua di tiket yang sama
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000020',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'aku benar-benar tidak ingin hidup lagi'
    );

    -- Verifikasi hit_count naik ke 2 tanpa baris alert baru
    SELECT count(*) INTO v_alert_count
    FROM public.crisis_alerts
    WHERE ticket_id = 'c3600000-0000-0000-0000-000000000020';

    ASSERT v_alert_count = 1, 'UJI 4.6 GAGAL: Baris alert peer_ticket tidak boleh duplikat';

    SELECT * INTO v_alert
    FROM public.crisis_alerts
    WHERE ticket_id = 'c3600000-0000-0000-0000-000000000020';

    ASSERT v_alert.hit_count = 2, format('UJI 4.7 GAGAL: hit_count peer_ticket harus 2, didapat: %s', v_alert.hit_count);

    -- Relawan mengirim pesan memuat kata kunci krisis -> diabaikan
    INSERT INTO public.peer_messages (
        ticket_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000020',
        'c3600000-0000-0000-0000-000000000003',
        'text',
        'jangan menyerah dan jangan menyakiti diri kamu ya'
    );

    SELECT hit_count INTO v_alert.hit_count
    FROM public.crisis_alerts
    WHERE ticket_id = 'c3600000-0000-0000-0000-000000000020';

    ASSERT v_alert.hit_count = 2, 'UJI 4.8 GAGAL: Pesan krisis dari relawan wajib diabaikan';
END $$;

-- ========================================================
-- 7. UJI 5: ISOLASI RLS CRISIS_ALERTS MENOLAK AKSES ANON & AUTHENTICATED (ERROR 42501)
-- ========================================================

-- 5a: Verifikasi hak istimewa via has_table_privilege
DO $$
BEGIN
    ASSERT has_table_privilege('anon', 'public.crisis_alerts', 'SELECT') = false,
        'UJI 5.1 GAGAL: Role anon tidak boleh memiliki hak SELECT pada crisis_alerts';
    ASSERT has_table_privilege('anon', 'public.crisis_alerts', 'INSERT') = false,
        'UJI 5.2 GAGAL: Role anon tidak boleh memiliki hak INSERT pada crisis_alerts';
    ASSERT has_table_privilege('authenticated', 'public.crisis_alerts', 'SELECT') = false,
        'UJI 5.3 GAGAL: Role authenticated tidak boleh memiliki hak SELECT pada crisis_alerts';
    ASSERT has_table_privilege('authenticated', 'public.crisis_alerts', 'INSERT') = false,
        'UJI 5.4 GAGAL: Role authenticated tidak boleh memiliki hak INSERT pada crisis_alerts';
    ASSERT has_table_privilege('authenticated', 'public.crisis_alerts', 'UPDATE') = false,
        'UJI 5.5 GAGAL: Role authenticated tidak boleh memiliki hak UPDATE pada crisis_alerts';
    ASSERT has_table_privilege('authenticated', 'public.crisis_alerts', 'DELETE') = false,
        'UJI 5.6 GAGAL: Role authenticated tidak boleh memiliki hak DELETE pada crisis_alerts';
    ASSERT has_table_privilege('service_role', 'public.crisis_alerts', 'SELECT') = true,
        'UJI 5.7 GAGAL: service_role wajib memiliki hak SELECT pada crisis_alerts';
END $$;

-- 5b: Eksekusi langsung SELECT oleh role authenticated melempar error 42501
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM * FROM public.crisis_alerts;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5.8 GAGAL: SELECT crisis_alerts oleh authenticated wajib ditolak (error 42501)';
END $$;
RESET ROLE;

-- 5c: Eksekusi langsung SELECT oleh role anon melempar error 42501
SET LOCAL ROLE anon;
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM * FROM public.crisis_alerts;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5.9 GAGAL: SELECT crisis_alerts oleh anon wajib ditolak (error 42501)';
END $$;
RESET ROLE;

-- ========================================================
-- 8. UJI 6: KOLOM ALERT_ID PADA EMERGENCY_CONTACT_ACCESS_LOG
-- ========================================================
DO $$
DECLARE
    v_alert_id UUID;
    v_log_id UUID;
    v_saved_alert_id UUID;
    v_threw_fk BOOLEAN := false;
BEGIN
    SELECT id INTO v_alert_id
    FROM public.crisis_alerts
    WHERE booking_id = 'c3600000-0000-0000-0000-000000000010'
    LIMIT 1;

    -- Pencatatan log akses kontak darurat dengan alert_id
    INSERT INTO public.emergency_contact_access_log (
        admin_id, patient_id, alert_id
    ) VALUES (
        'c3600000-0000-0000-0000-000000000001',
        'c3600000-0000-0000-0000-000000000004',
        v_alert_id
    ) RETURNING id INTO v_log_id;

    ASSERT v_log_id IS NOT NULL, 'UJI 6.1 GAGAL: Gagal menyimpan log akses kontak darurat dengan alert_id';

    SELECT alert_id INTO v_saved_alert_id
    FROM public.emergency_contact_access_log
    WHERE id = v_log_id;

    ASSERT v_saved_alert_id = v_alert_id, 'UJI 6.2 GAGAL: Kolom alert_id pada log audit tidak tersimpan dengan benar';

    -- Validasi FK: alert_id yang tidak ada di crisis_alerts wajib melempar foreign key violation (23503)
    BEGIN
        INSERT INTO public.emergency_contact_access_log (
            admin_id, patient_id, alert_id
        ) VALUES (
            'c3600000-0000-0000-0000-000000000001',
            'c3600000-0000-0000-0000-000000000004',
            'ffffffff-ffff-ffff-ffff-ffffffffffff'
        );
    EXCEPTION
        WHEN foreign_key_violation THEN
            v_threw_fk := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '23503' THEN v_threw_fk := true; END IF;
    END;

    ASSERT v_threw_fk = true, 'UJI 6.3 GAGAL: Foreign key alert_id wajib menolak ID yang tidak ada di crisis_alerts';
END $$;

-- ========================================================
-- 9. UJI 7: SIFAT NON-BLOCKING FAIL-SAFE TRIGGER
-- ========================================================
DO $$
DECLARE
    v_msg_id UUID;
BEGIN
    -- Simulasikan kegagalan fatal pada fungsi trigger:
    -- Drop tabel crisis_alerts sehingga trigger akan mengalami error internal saat query/insert
    DROP TABLE public.crisis_alerts CASCADE;

    -- Pasien mengirim pesan chat memuat frasa krisis saat tabel crisis_alerts rusak/hilang
    -- Karena ada blok EXCEPTION WHEN OTHERS THEN NULL, kegagalan trigger TIDAK BOLEH membatalkan insert pesan
    INSERT INTO public.session_messages (
        booking_id, sender_id, kind, body
    ) VALUES (
        'c3600000-0000-0000-0000-000000000010',
        'c3600000-0000-0000-0000-000000000004',
        'text',
        'saya benar-benar ingin mengakhiri hidup'
    ) RETURNING id INTO v_msg_id;

    ASSERT v_msg_id IS NOT NULL,
        'UJI 7 GAGAL: Insert pesan chat harus tetap berhasil saat fungsi trigger mengalami kegagalan internal (non-blocking fail-safe)';

    RAISE NOTICE 'SELURUH UJI DRY-RUN CRISIS FEED & DETEKSI KRISIS LULUS 100%%';
END $$;

ROLLBACK;
