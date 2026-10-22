-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000022 (PEER MESSAGES, REALTIME & RLS)
-- Path: supabase/tests/peer_messages_dryrun.sql
-- Scope:
-- 1. Setup fixture auth.users, public.users, public.peer_tickets
-- 2. DDL Salinan persis dari 20261022000022_peer_messages.sql
-- 3. Assert Uji 1: Pembuatan pesan teks valid oleh pasien dan relawan (berhasil)
-- 4. Assert Uji 2: Penolakan pesan teks dengan body kosong / spasi / NULL (chk_peer_messages_content)
-- 5. Assert Uji 3: Pembuatan pesan gambar dan suara dengan media_path (berhasil)
-- 6. Assert Uji 4: Penolakan pesan media tanpa media_path (chk_peer_messages_content)
-- 7. Assert Uji 5: RLS SELECT (peserta tiket & admin dapat membaca, user lain melihat 0 baris)
-- 8. Assert Uji 6: RLS INSERT (peserta tiket dapat mengirim, non-peserta & pemalsuan sender_id ditolak)
-- 9. Assert Uji 7: Hak mutasi UPDATE dan DELETE dicabut dari role authenticated
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP USER TEST: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_relawan@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_admin@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('e4000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pm_other@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('e1000000-0000-0000-0000-000000000001', 'pm_pasien@temanbicara.test', '081255550001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('e2000000-0000-0000-0000-000000000001', 'pm_relawan@temanbicara.test', '081255550002', 'relawan'::public.user_role, 'active'::public.account_status),
    ('e3000000-0000-0000-0000-000000000001', 'pm_admin@temanbicara.test', '081255550003', 'admin'::public.user_role, 'active'::public.account_status),
    ('e4000000-0000-0000-0000-000000000001', 'pm_other@temanbicara.test', '081255550004', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Helper RLS is_admin() jika belum tersedia di environment test
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

-- Setup tabel peer_tickets jika belum ada (idempoten untuk environment dry-run terisolasi)
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
    archived_at TIMESTAMPTZ NULL,
    abandoned_by UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Fixture Tiket Sesi Curhat Sebaya
INSERT INTO public.peer_tickets (
    id,
    patient_id,
    patient_alias,
    topic,
    emotion,
    content,
    is_anonymous,
    status,
    claimed_by,
    claimed_at,
    first_response_at
)
VALUES (
    'f1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'Lentera Malam',
    'Kecemasan',
    'Gelisah',
    'Cerita pengujian dry-run sistem pesan ruang dengar sebaya...',
    true,
    'active'::public.peer_ticket_status,
    'e2000000-0000-0000-0000-000000000001',
    pg_catalog.now() - interval '30 minutes',
    pg_catalog.now() - interval '20 minutes'
)
ON CONFLICT (id) DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    status = EXCLUDED.status,
    claimed_by = EXCLUDED.claimed_by;

-- ========================================================
-- 2. DDL MIGRATION: 20261022000022_peer_messages.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.peer_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.peer_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice')),
    body TEXT NULL CHECK (body IS NULL OR pg_catalog.char_length(body) <= 4000),
    media_path TEXT NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_peer_messages_content CHECK (
        (kind = 'text' AND pg_catalog.btrim(COALESCE(body, '')) <> '') OR
        (kind IN ('image', 'voice') AND media_path IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_peer_messages_ticket_created
    ON public.peer_messages (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_peer_messages_sender_id
    ON public.peer_messages (sender_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
    ELSE
        CREATE PUBLICATION supabase_realtime FOR TABLE public.peer_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS peer_messages_insert_participant ON public.peer_messages;
CREATE POLICY peer_messages_insert_participant ON public.peer_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        (
            auth.uid() = sender_id
            AND EXISTS (
                SELECT 1 FROM public.peer_tickets t
                WHERE t.id = peer_messages.ticket_id
                  AND (t.patient_id = auth.uid() OR t.claimed_by = auth.uid())
            )
        )
        OR public.is_admin()
    );

REVOKE ALL ON public.peer_messages FROM PUBLIC, anon;
REVOKE UPDATE, DELETE ON public.peer_messages FROM authenticated;
GRANT SELECT, INSERT ON public.peer_messages TO authenticated;
GRANT ALL ON public.peer_messages TO service_role;

-- ========================================================
-- 3. SUITE PENGUJIAN SKENARIO & ASSERTIONS
-- ========================================================

DO $$
DECLARE
    v_msg_text_p UUID;
    v_msg_text_r UUID;
    v_msg_img UUID;
    v_msg_voice UUID;
    v_threw BOOLEAN;
BEGIN
    -- ----------------------------------------------------
    -- UJI 1: Pembuatan pesan teks valid oleh pasien dan relawan (berhasil)
    -- ----------------------------------------------------
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000001',
        'text',
        'Halo relawan, terima kasih sudah menerima tiket curhatku.'
    ) RETURNING id INTO v_msg_text_p;

    ASSERT v_msg_text_p IS NOT NULL, 'UJI 1a GAGAL: Pesan teks pasien valid gagal disimpan';

    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000001',
        'text',
        'Halo, sama-sama. Aku siap mendengarkan ceritamu dengan tenang.'
    ) RETURNING id INTO v_msg_text_r;

    ASSERT v_msg_text_r IS NOT NULL, 'UJI 1b GAGAL: Pesan teks relawan valid gagal disimpan';

    -- ----------------------------------------------------
    -- UJI 2: Penolakan pesan teks dengan body kosong / spasi / NULL
    -- ----------------------------------------------------
    -- Uji 2a: Body string kosong ''
    v_threw := false;
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'text', '');
    EXCEPTION
        WHEN check_violation THEN
            v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI 2a GAGAL: Pesan teks dengan body kosong harus ditolak constraint chk_peer_messages_content';

    -- Uji 2b: Body hanya spasi '   '
    v_threw := false;
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'text', '   ');
    EXCEPTION
        WHEN check_violation THEN
            v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI 2b GAGAL: Pesan teks dengan body spasi harus ditolak constraint chk_peer_messages_content';

    -- Uji 2c: Body NULL
    v_threw := false;
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'text', NULL);
    EXCEPTION
        WHEN check_violation THEN
            v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI 2c GAGAL: Pesan teks dengan body NULL harus ditolak constraint chk_peer_messages_content';

    -- ----------------------------------------------------
    -- UJI 3: Pembuatan pesan gambar dan suara dengan media_path (berhasil)
    -- ----------------------------------------------------
    -- Uji 3a: Pesan gambar dengan media_path dan caption opsional
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body, media_path)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000001',
        'image',
        'Gambar catatan perasaan hari ini',
        'peer/f1000000-0000-0000-0000-000000000001/catatan.png'
    ) RETURNING id INTO v_msg_img;

    ASSERT v_msg_img IS NOT NULL, 'UJI 3a GAGAL: Pesan gambar dengan media_path gagal disimpan';

    -- Uji 3b: Pesan rekaman suara dengan media_path dan duration_seconds
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, media_path, duration_seconds)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000001',
        'voice',
        'peer/f1000000-0000-0000-0000-000000000001/suara.ogg',
        42
    ) RETURNING id INTO v_msg_voice;

    ASSERT v_msg_voice IS NOT NULL, 'UJI 3b GAGAL: Pesan suara dengan media_path gagal disimpan';

    -- ----------------------------------------------------
    -- UJI 4: Penolakan pesan media tanpa media_path
    -- ----------------------------------------------------
    -- Uji 4a: Gambar tanpa media_path (NULL)
    v_threw := false;
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body, media_path)
        VALUES ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'image', 'Caption tanpa media', NULL);
    EXCEPTION
        WHEN check_violation THEN
            v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI 4a GAGAL: Pesan gambar tanpa media_path harus ditolak constraint chk_peer_messages_content';

    -- Uji 4b: Suara tanpa media_path (NULL)
    v_threw := false;
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, duration_seconds, media_path)
        VALUES ('f1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'voice', 25, NULL);
    EXCEPTION
        WHEN check_violation THEN
            v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI 4b GAGAL: Pesan suara tanpa media_path harus ditolak constraint chk_peer_messages_content';

    RAISE NOTICE 'SKENARIO BISNIS 1-4 LULUS.';
END $$;

-- ========================================================
-- 4. UJI ROW LEVEL SECURITY (RLS)
-- ========================================================

-- UJI RLS 5a: User lain (bukan peserta tiket) SELECT peer_messages -> 0 baris
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_messages;
    ASSERT v_count = 0, format('UJI RLS 5a GAGAL: User lain melihat %s baris pesan (seharusnya 0)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 5b: Pasien peserta SELECT peer_messages -> melihat 4 baris pesan
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_messages;
    ASSERT v_count = 4, format('UJI RLS 5b GAGAL: Pasien peserta melihat %s baris pesan (seharusnya 4)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 5c: Relawan peserta SELECT peer_messages -> melihat 4 baris pesan
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_messages;
    ASSERT v_count = 4, format('UJI RLS 5c GAGAL: Relawan peserta melihat %s baris pesan (seharusnya 4)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 5d: Admin SELECT peer_messages -> melihat seluruh pesan
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_messages;
    ASSERT v_count = 4, format('UJI RLS 5d GAGAL: Admin melihat %s baris pesan (seharusnya 4)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 6a: Pasien peserta INSERT pesan dengan sender_id miliknya -> BERHASIL
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000001',
        'text',
        'Pesan tambahan dari pasien berautentikasi'
    ) RETURNING id INTO v_new_id;

    ASSERT v_new_id IS NOT NULL, 'UJI RLS 6a GAGAL: Pasien peserta harus bisa INSERT pesan miliknya';
END $$;

RESET ROLE;

-- UJI RLS 6b: Relawan peserta INSERT pesan dengan sender_id miliknya -> BERHASIL
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
    VALUES (
        'f1000000-0000-0000-0000-000000000001',
        'e2000000-0000-0000-0000-000000000001',
        'text',
        'Pesan tambahan dari relawan berautentikasi'
    ) RETURNING id INTO v_new_id;

    ASSERT v_new_id IS NOT NULL, 'UJI RLS 6b GAGAL: Relawan peserta harus bisa INSERT pesan miliknya';
END $$;

RESET ROLE;

-- UJI RLS 6c: User lain (bukan peserta tiket) mencoba INSERT -> DITOLAK
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES (
            'f1000000-0000-0000-0000-000000000001',
            'e4000000-0000-0000-0000-000000000001',
            'text',
            'Pesan penyusup dari bukan peserta tiket'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI RLS 6c GAGAL: User lain yang bukan peserta tiket harus ditolak saat INSERT';
END $$;

RESET ROLE;

-- UJI RLS 6d: Pasien mencoba memalsukan sender_id (spoofing sender_id = relawan) -> DITOLAK
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.peer_messages (ticket_id, sender_id, kind, body)
        VALUES (
            'f1000000-0000-0000-0000-000000000001',
            'e2000000-0000-0000-0000-000000000001',
            'text',
            'Pesan spoofing memalsukan sender_id relawan'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI RLS 6d GAGAL: Upaya spoofing sender_id harus ditolak oleh RLS WITH CHECK';
END $$;

RESET ROLE;

-- UJI RLS 7a: Mutasi UPDATE langsung ke peer_messages dicabut dari authenticated -> DITOLAK
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.peer_messages SET body = 'Perubahan pesan ilegal';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI RLS 7a GAGAL: UPDATE langsung pada peer_messages harus ditolak';
END $$;

RESET ROLE;

-- UJI RLS 7b: Mutasi DELETE langsung ke peer_messages dicabut dari authenticated -> DITOLAK
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        DELETE FROM public.peer_messages;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_threw := true;
            ELSE
                RAISE;
            END IF;
    END;

    ASSERT v_threw = true, 'UJI RLS 7b GAGAL: DELETE langsung pada peer_messages harus ditolak';
END $$;

RESET ROLE;

DO $$
BEGIN
    RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN PEER MESSAGES LULUS.';
END $$;

-- ========================================================
-- ROLLBACK UNTUK MENJAGA DATABASE TEST TETAP BERSIH
-- ========================================================
ROLLBACK;
