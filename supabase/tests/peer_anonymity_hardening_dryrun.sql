-- ========================================================
-- TEMAN BICARA: DRY-RUN HARDENING ANONIMITAS PEER (PRD-048 / T-205)
-- Path: supabase/tests/peer_anonymity_hardening_dryrun.sql
-- ========================================================
-- Jalankan sebagai owner di lingkungan uji/dev; seluruh perubahan dibatalkan (ROLLBACK).

BEGIN;

-- 1. SETUP KOLOM SENDER_ROLE (JIKA BELUM ADA)
ALTER TABLE public.peer_messages
    ADD COLUMN IF NOT EXISTS sender_role text NULL;

-- 2. SETUP DATA UJI (FIXTURES)
DO $$
DECLARE
    v_patient_id uuid := pg_catalog.gen_random_uuid();
    v_relawan_id uuid := pg_catalog.gen_random_uuid();
    v_stranger_id uuid := pg_catalog.gen_random_uuid();
    v_ticket_id uuid := pg_catalog.gen_random_uuid();
    v_msg1_id uuid := pg_catalog.gen_random_uuid();
    v_msg2_id uuid := pg_catalog.gen_random_uuid();
    v_msg3_id uuid := pg_catalog.gen_random_uuid();
    v_msg4_id uuid := pg_catalog.gen_random_uuid();
    v_col text;
    v_stranger_rejected boolean := false;
BEGIN
    -- Simpan UUID ke session config agar bisa diakses di langkah pengujian berikutnya
    PERFORM set_config('t205.patient_id', v_patient_id::text, true);
    PERFORM set_config('t205.relawan_id', v_relawan_id::text, true);
    PERFORM set_config('t205.stranger_id', v_stranger_id::text, true);
    PERFORM set_config('t205.ticket_id', v_ticket_id::text, true);
    PERFORM set_config('t205.msg1_id', v_msg1_id::text, true);
    PERFORM set_config('t205.msg2_id', v_msg2_id::text, true);
    PERFORM set_config('t205.msg3_id', v_msg3_id::text, true);
    PERFORM set_config('t205.msg4_id', v_msg4_id::text, true);

    -- Fixture auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES
        (v_patient_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_patient_id::text || '@temanbicara.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_relawan_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_relawan_id::text || '@temanbicara.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_stranger_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_stranger_id::text || '@temanbicara.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

    -- Fixture public.users
    INSERT INTO public.users (id, email, role, status)
    VALUES
        (v_patient_id, v_patient_id::text || '@temanbicara.test', 'pasien', 'active'),
        (v_relawan_id, v_relawan_id::text || '@temanbicara.test', 'relawan', 'active'),
        (v_stranger_id, v_stranger_id::text || '@temanbicara.test', 'pasien', 'active');

    -- Fixture public.peer_tickets (status open agar tidak memicu notifikasi)
    INSERT INTO public.peer_tickets (
        id, patient_id, patient_alias, topic, emotion, content, status, claimed_by, claimed_at
    )
    VALUES (
        v_ticket_id, v_patient_id, 'Teman Curhat', 'Kecemasan', 'Cemas', 'Cerita uji T-205', 'open', v_relawan_id, now()
    );

    -- Fixture pesan lama dengan sender_role NULL untuk menguji backfill
    INSERT INTO public.peer_messages (id, ticket_id, sender_id, kind, body, sender_role)
    VALUES
        (v_msg1_id, v_ticket_id, v_patient_id, 'text', 'Pesan fixture pasien sebelum backfill', NULL),
        (v_msg2_id, v_ticket_id, v_relawan_id, 'text', 'Pesan fixture relawan sebelum backfill', NULL);
END $$;

-- 3. JALANKAN BACKFILL DDL
UPDATE public.peer_messages m
SET sender_role = CASE
    WHEN m.sender_id = t.patient_id THEN 'patient'
    WHEN m.sender_id = t.claimed_by THEN 'relawan'
    ELSE NULL
END
FROM public.peer_tickets t
WHERE t.id = m.ticket_id AND m.sender_role IS NULL;

-- 4. VERIFIKASI HASIL BACKFILL
DO $$
DECLARE
    v_role_1 text;
    v_role_2 text;
BEGIN
    SELECT sender_role INTO v_role_1
    FROM public.peer_messages
    WHERE id = current_setting('t205.msg1_id')::uuid;

    SELECT sender_role INTO v_role_2
    FROM public.peer_messages
    WHERE id = current_setting('t205.msg2_id')::uuid;

    ASSERT v_role_1 = 'patient', 'Backfill gagal: msg1 harus memiliki sender_role = patient, didapat: ' || COALESCE(v_role_1, 'NULL');
    ASSERT v_role_2 = 'relawan', 'Backfill gagal: msg2 harus memiliki sender_role = relawan, didapat: ' || COALESCE(v_role_2, 'NULL');
    ASSERT NOT EXISTS (
        SELECT 1 FROM public.peer_messages WHERE sender_role IS NULL
    ), 'Backfill gagal: masih ada baris dengan sender_role NULL';
END $$;

-- 5. TERAPKAN NOT NULL & CHECK CONSTRAINT
ALTER TABLE public.peer_messages
    ALTER COLUMN sender_role SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_peer_messages_sender_role'
          AND conrelid = 'public.peer_messages'::regclass
    ) THEN
        ALTER TABLE public.peer_messages
            ADD CONSTRAINT chk_peer_messages_sender_role
            CHECK (sender_role IN ('patient', 'relawan'));
    END IF;
END $$;

-- 6. BUAT TRIGGER BEFORE INSERT
CREATE OR REPLACE FUNCTION public.peer_messages_set_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
    v_claimed_by UUID;
BEGIN
    SELECT patient_id, claimed_by
    INTO v_patient_id, v_claimed_by
    FROM public.peer_tickets
    WHERE id = NEW.ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SENDER' USING ERRCODE = 'P0002';
    END IF;

    IF NEW.sender_id = v_patient_id THEN
        NEW.sender_role := 'patient';
    ELSIF NEW.sender_id = v_claimed_by THEN
        NEW.sender_role := 'relawan';
    ELSE
        RAISE EXCEPTION 'INVALID_SENDER' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_messages_set_sender_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_messages_set_sender_role() TO service_role;

DROP TRIGGER IF EXISTS trg_peer_messages_set_sender_role ON public.peer_messages;
CREATE TRIGGER trg_peer_messages_set_sender_role
    BEFORE INSERT ON public.peer_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.peer_messages_set_sender_role();

-- 7. VERIFIKASI TRIGGER: PENGISI OTOMATIS & TOLAK PENGIRIM ASING
DO $$
DECLARE
    v_ticket_id uuid := current_setting('t205.ticket_id')::uuid;
    v_patient_id uuid := current_setting('t205.patient_id')::uuid;
    v_relawan_id uuid := current_setting('t205.relawan_id')::uuid;
    v_stranger_id uuid := current_setting('t205.stranger_id')::uuid;
    v_msg3_id uuid := current_setting('t205.msg3_id')::uuid;
    v_msg4_id uuid := current_setting('t205.msg4_id')::uuid;
    v_role_3 text;
    v_role_4 text;
    v_rejected boolean := false;
BEGIN
    -- Uji trigger: insert pasien tanpa mengisi sender_role
    INSERT INTO public.peer_messages (id, ticket_id, sender_id, kind, body)
    VALUES (v_msg3_id, v_ticket_id, v_patient_id, 'text', 'Pesan baru dari pasien');

    SELECT sender_role INTO v_role_3
    FROM public.peer_messages WHERE id = v_msg3_id;
    ASSERT v_role_3 = 'patient', 'Trigger gagal: sender_role pasien tidak terisi otomatis (didapat: ' || COALESCE(v_role_3, 'NULL') || ')';

    -- Uji trigger: insert relawan tanpa mengisi sender_role
    INSERT INTO public.peer_messages (id, ticket_id, sender_id, kind, body)
    VALUES (v_msg4_id, v_ticket_id, v_relawan_id, 'text', 'Pesan baru dari relawan');

    SELECT sender_role INTO v_role_4
    FROM public.peer_messages WHERE id = v_msg4_id;
    ASSERT v_role_4 = 'relawan', 'Trigger gagal: sender_role relawan tidak terisi otomatis (didapat: ' || COALESCE(v_role_4, 'NULL') || ')';

    -- Uji trigger: tolak pengirim asing (bukan patient maupun claimed_by)
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES (v_ticket_id, v_stranger_id, 'text', 'Pesan tidak sah dari user asing');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%INVALID_SENDER%' THEN
            v_rejected := true;
        ELSE
            RAISE EXCEPTION 'Trigger melempar error tidak sesuai: %', SQLERRM;
        END IF;
    END;

    ASSERT v_rejected = true, 'Trigger gagal: pesan dari user asing tidak ditolak';
END $$;

-- 8. TERAPKAN PERUBAHAN GRANT SELECT (HARDENING HAK AKSES)
REVOKE SELECT ON public.peer_messages FROM authenticated;
REVOKE SELECT ON public.peer_reviews FROM authenticated;
REVOKE SELECT ON public.tips FROM authenticated;

REVOKE SELECT (sender_id) ON public.peer_messages FROM authenticated;
REVOKE SELECT (patient_id) ON public.peer_reviews FROM authenticated;
REVOKE SELECT (patient_id) ON public.tips FROM authenticated;

GRANT SELECT (
    id, ticket_id, kind, body, media_path, duration_seconds, created_at, sender_role
) ON public.peer_messages TO authenticated;

GRANT SELECT (
    ticket_id, relawan_id, rating, review, is_hidden, created_at, updated_at
) ON public.peer_reviews TO authenticated;

GRANT SELECT (
    id, mitra_id, coins, mitra_share_bps, source_type, source_id, created_at
) ON public.tips TO authenticated;

GRANT ALL ON public.peer_messages TO service_role;
GRANT ALL ON public.peer_reviews TO service_role;
GRANT ALL ON public.tips TO service_role;

-- 9. VERIFIKASI HAK AKSES PER-KOLOM (PRIVILEGE AUDIT)
DO $$
DECLARE
    v_col text;
BEGIN
    -- A. Kolom sensitif WAJIB false untuk authenticated
    ASSERT NOT has_column_privilege('authenticated', 'public.peer_messages', 'sender_id', 'SELECT'),
        'Celah: sender_id masih dapat dibaca oleh role authenticated pada peer_messages';
    ASSERT NOT has_column_privilege('authenticated', 'public.peer_reviews', 'patient_id', 'SELECT'),
        'Celah: patient_id masih dapat dibaca oleh role authenticated pada peer_reviews';
    ASSERT NOT has_column_privilege('authenticated', 'public.tips', 'patient_id', 'SELECT'),
        'Celah: patient_id masih dapat dibaca oleh role authenticated pada tips';

    -- B. Kolom publik peer_messages WAJIB true
    FOREACH v_col IN ARRAY ARRAY['id', 'ticket_id', 'kind', 'body', 'media_path', 'duration_seconds', 'created_at', 'sender_role'] LOOP
        ASSERT has_column_privilege('authenticated', 'public.peer_messages', v_col, 'SELECT'),
            'Kolom peer_messages tidak dapat dibaca: ' || v_col;
    END LOOP;

    -- C. Kolom publik peer_reviews WAJIB true
    FOREACH v_col IN ARRAY ARRAY['ticket_id', 'relawan_id', 'rating', 'review', 'is_hidden', 'created_at', 'updated_at'] LOOP
        ASSERT has_column_privilege('authenticated', 'public.peer_reviews', v_col, 'SELECT'),
            'Kolom peer_reviews tidak dapat dibaca: ' || v_col;
    END LOOP;

    -- D. Kolom publik tips WAJIB true
    FOREACH v_col IN ARRAY ARRAY['id', 'mitra_id', 'coins', 'mitra_share_bps', 'source_type', 'source_id', 'created_at'] LOOP
        ASSERT has_column_privilege('authenticated', 'public.tips', v_col, 'SELECT'),
            'Kolom tips tidak dapat dibaca: ' || v_col;
    END LOOP;

    -- E. Hak akses tingkat tabel authenticated WAJIB false (hanya per-kolom yang diizinkan)
    ASSERT NOT has_table_privilege('authenticated', 'public.peer_messages', 'SELECT'),
        'Grant SELECT tingkat tabel masih ada pada peer_messages untuk authenticated';
    ASSERT NOT has_table_privilege('authenticated', 'public.peer_reviews', 'SELECT'),
        'Grant SELECT tingkat tabel masih ada pada peer_reviews untuk authenticated';
    ASSERT NOT has_table_privilege('authenticated', 'public.tips', 'SELECT'),
        'Grant SELECT tingkat tabel masih ada pada tips untuk authenticated';

    -- F. Hak akses trigger function: hanya service_role
    ASSERT NOT has_function_privilege('authenticated', 'public.peer_messages_set_sender_role()', 'EXECUTE'),
        'Trigger function dapat di-EXECUTE oleh authenticated';
    ASSERT NOT has_function_privilege('anon', 'public.peer_messages_set_sender_role()', 'EXECUTE'),
        'Trigger function dapat di-EXECUTE oleh anon';
    ASSERT has_function_privilege('service_role', 'public.peer_messages_set_sender_role()', 'EXECUTE'),
        'Trigger function tidak dapat di-EXECUTE oleh service_role';

    -- G. Hak akses service_role pada tabel tetap penuh
    ASSERT has_table_privilege('service_role', 'public.peer_messages', 'SELECT'), 'service_role hilang SELECT peer_messages';
    ASSERT has_table_privilege('service_role', 'public.peer_reviews', 'SELECT'), 'service_role hilang SELECT peer_reviews';
    ASSERT has_table_privilege('service_role', 'public.tips', 'SELECT'), 'service_role hilang SELECT tips';

    -- Seluruh assert berhasil
    RAISE EXCEPTION 'DRYRUN_OK';
END $$;

ROLLBACK;
