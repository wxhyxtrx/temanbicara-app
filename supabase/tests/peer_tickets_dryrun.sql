-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000020 (PEER TICKETS & KUOTA RELAWAN)
-- Path: supabase/tests/peer_tickets_dryrun.sql
-- Scope:
-- 1. Setup fixture auth.users, public.users, profiles, system_settings
-- 2. DDL Salinan persis dari 20261021000020_peer_tickets.sql
-- 3. Assert Uji 1: peer_ticket_create berhasil (status 'open')
-- 4. Assert Uji 2: peer_ticket_create ganda pasien aktif ditolak (ACTIVE_TICKET_EXISTS)
-- 5. Assert Uji 3: peer_ticket_create oleh role non-pasien ditolak (FORBIDDEN_ROLE)
-- 6. Assert Uji 4: peer_ticket_claim relawan berhasil (status 'claimed', tickets_claimed = 1)
-- 7. Assert Uji 5: peer_ticket_claim tiket yang sudah claimed ditolak (TICKET_NOT_AVAILABLE)
-- 8. Assert Uji 6: peer_ticket_claim saat kuota harian habis (3) ditolak (DAILY_QUOTA_EXHAUSTED)
-- 9. Assert Uji 7: peer_ticket_first_response tepat waktu ubah status jadi 'active'
-- 10. Assert Uji 8: peer_ticket_first_response timeout (>10 menit) return tiket open, catat abandoned_by, tambah penalti tanpa exception
-- 11. Assert Uji 9: peer_ticket_claim relawan di abandoned_by ditolak (TICKET_PREVIOUSLY_ABANDONED)
-- 12. Assert Uji 10: peer_ticket_tick timeout claimed tiket kembalikan ke open & beri penalti
-- 13. Assert Uji 11: peer_ticket_tick arsipkan tiket open > 24 jam jadi 'archived'
-- 14. Assert Uji 12: Pasien dengan tiket archived dapat membuat tiket baru (partial unique index)
-- 15. Assert Uji 13: Penegakan kuota carry penalty hari kemarin (maksimal 1 poin)
-- 16. Assert Uji RLS: peer_tickets (pasien, relawan 0 baris demi privasi patient_id, admin, hak mutasi dicabut)
-- 17. Assert Uji RLS: relawan_daily_quota (relawan sendiri, admin, hak mutasi dicabut)
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP USER TEST: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test3@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test4@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test5@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test6@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test7@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test8@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p_test9@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r_test1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r_test2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r_test3@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm_test@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('a4000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other_test@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'p_test1@temanbicara.test', '081211110001', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000002', 'p_test2@temanbicara.test', '081211110002', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000003', 'p_test3@temanbicara.test', '081211110003', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000004', 'p_test4@temanbicara.test', '081211110004', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000005', 'p_test5@temanbicara.test', '081211110005', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000006', 'p_test6@temanbicara.test', '081211110006', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000007', 'p_test7@temanbicara.test', '081211110007', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000008', 'p_test8@temanbicara.test', '081211110008', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a1000000-0000-0000-0000-000000000009', 'p_test9@temanbicara.test', '081211110009', 'pasien'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000001', 'r_test1@temanbicara.test', '081222220001', 'relawan'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000002', 'r_test2@temanbicara.test', '081222220002', 'relawan'::public.user_role, 'active'::public.account_status),
    ('a2000000-0000-0000-0000-000000000003', 'r_test3@temanbicara.test', '081222220003', 'relawan'::public.user_role, 'active'::public.account_status),
    ('a3000000-0000-0000-0000-000000000001', 'adm_test@temanbicara.test', '081233330001', 'admin'::public.user_role, 'active'::public.account_status),
    ('a4000000-0000-0000-0000-000000000001', 'other_test@temanbicara.test', '081244440001', 'psikolog'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Setup profil
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Pasien Satu', 'Satu', 'Keluarga 1', '081200000001', true),
    ('a1000000-0000-0000-0000-000000000002', 'Pasien Dua', 'Dua', 'Keluarga 2', '081200000002', true),
    ('a1000000-0000-0000-0000-000000000003', 'Pasien Tiga', 'Tiga', 'Keluarga 3', '081200000003', true),
    ('a1000000-0000-0000-0000-000000000004', 'Pasien Empat', 'Empat', 'Keluarga 4', '081200000004', true),
    ('a1000000-0000-0000-0000-000000000005', 'Pasien Lima', 'Lima', 'Keluarga 5', '081200000005', true),
    ('a1000000-0000-0000-0000-000000000006', 'Pasien Enam', 'Enam', 'Keluarga 6', '081200000006', true),
    ('a1000000-0000-0000-0000-000000000007', 'Pasien Tujuh', 'Tujuh', 'Keluarga 7', '081200000007', true),
    ('a1000000-0000-0000-0000-000000000008', 'Pasien Delapan', 'Delapan', 'Keluarga 8', '081200000008', true),
    ('a1000000-0000-0000-0000-000000000009', 'Pasien Sembilan', 'Sembilan', 'Keluarga 9', '081200000009', true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.relawan_profiles (user_id, nama_lengkap, latar_belakang, dokumen_cv_url, alasan_bergabung, total_sesi, alias_name, is_available, topik_keahlian)
VALUES
    ('a2000000-0000-0000-0000-000000000001', 'Relawan Satu', 'Psikologi UI', 'https://cv.test/r1.pdf', 'Peduli kesehatan mental', 0, 'Teman Bintang', true, ARRAY['Kesepian', 'Kecemasan']),
    ('a2000000-0000-0000-0000-000000000002', 'Relawan Dua', 'Psikologi UGM', 'https://cv.test/r2.pdf', 'Suka mendengarkan', 0, 'Teman Awan', true, ARRAY['Stres Akademik', 'Karier']),
    ('a2000000-0000-0000-0000-000000000003', 'Relawan Tiga', 'Psikologi Unpad', 'https://cv.test/r3.pdf', 'Peduli sesama', 0, 'Teman Hujan', true, ARRAY['Keluarga', 'Karier'])
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.admin_profiles (user_id, nama_lengkap, level)
VALUES
    ('a3000000-0000-0000-0000-000000000001', 'Admin Peer Supervisor', 'superadmin')
ON CONFLICT (user_id) DO NOTHING;

-- Setup system_settings untuk relawan
INSERT INTO public.system_settings (key, value)
VALUES
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24, "max_carry_penalty": 1}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Helper RLS is_admin() jika belum ada
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
-- 2. DDL MIGRATION: 20261021000020_peer_tickets.sql
-- ========================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS peer_tickets_active_patient_idx
    ON public.peer_tickets(patient_id)
    WHERE status IN ('open', 'claimed', 'active');

CREATE INDEX IF NOT EXISTS idx_peer_tickets_status ON public.peer_tickets(status);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_patient_id ON public.peer_tickets(patient_id);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_claimed_by ON public.peer_tickets(claimed_by);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_created_at ON public.peer_tickets(created_at);

CREATE TABLE IF NOT EXISTS public.relawan_daily_quota (
    relawan_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quota_date DATE NOT NULL,
    tickets_claimed INT NOT NULL DEFAULT 0 CHECK (tickets_claimed >= 0),
    penalty_points INT NOT NULL DEFAULT 0 CHECK (penalty_points >= 0),
    PRIMARY KEY (relawan_id, quota_date)
);

CREATE INDEX IF NOT EXISTS idx_relawan_daily_quota_date ON public.relawan_daily_quota(quota_date);

ALTER TABLE public.peer_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_tickets_select_policy ON public.peer_tickets;
CREATE POLICY peer_tickets_select_policy ON public.peer_tickets
    FOR SELECT TO authenticated
    USING (
        auth.uid() = patient_id
        OR public.is_admin()
    );

REVOKE ALL ON public.peer_tickets FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.peer_tickets FROM authenticated;
GRANT SELECT ON public.peer_tickets TO authenticated;
GRANT ALL ON public.peer_tickets TO service_role;

ALTER TABLE public.relawan_daily_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relawan_daily_quota_select_policy ON public.relawan_daily_quota;
CREATE POLICY relawan_daily_quota_select_policy ON public.relawan_daily_quota
    FOR SELECT TO authenticated
    USING (
        auth.uid() = relawan_id
        OR public.is_admin()
    );

REVOKE ALL ON public.relawan_daily_quota FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.relawan_daily_quota FROM authenticated;
GRANT SELECT ON public.relawan_daily_quota TO authenticated;
GRANT ALL ON public.relawan_daily_quota TO service_role;

-- 3. RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.peer_ticket_create(
    p_patient_id UUID,
    p_alias TEXT,
    p_topic TEXT,
    p_emotion TEXT,
    p_content TEXT,
    p_is_anon BOOLEAN DEFAULT true
)
RETURNS public.peer_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_role public.user_role;
    v_user_status public.account_status;
    v_ticket public.peer_tickets;
BEGIN
    IF p_patient_id IS NULL
       OR p_alias IS NULL OR pg_catalog.btrim(p_alias) = ''
       OR p_topic IS NULL OR pg_catalog.btrim(p_topic) = ''
       OR p_emotion IS NULL OR pg_catalog.btrim(p_emotion) = ''
       OR p_content IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_content)) < 10 THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING MESSAGE = 'Parameter tiket tidak valid (konten minimal 10 karakter).';
    END IF;

    SELECT role, status INTO v_user_role, v_user_status
    FROM public.users
    WHERE id = p_patient_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING MESSAGE = 'Pengguna pasien tidak ditemukan.';
    END IF;

    IF v_user_role <> 'pasien'::public.user_role OR v_user_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'FORBIDDEN_ROLE' USING MESSAGE = 'Hanya pasien aktif yang dapat membuat tiket curhat.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.peer_tickets
        WHERE patient_id = p_patient_id
          AND status IN ('open'::public.peer_ticket_status, 'claimed'::public.peer_ticket_status, 'active'::public.peer_ticket_status)
    ) THEN
        RAISE EXCEPTION 'ACTIVE_TICKET_EXISTS' USING MESSAGE = 'Pasien masih memiliki tiket curhat yang sedang aktif.';
    END IF;

    INSERT INTO public.peer_tickets (
        patient_id,
        patient_alias,
        topic,
        emotion,
        content,
        is_anonymous,
        status,
        created_at,
        updated_at
    )
    VALUES (
        p_patient_id,
        pg_catalog.btrim(p_alias),
        pg_catalog.btrim(p_topic),
        pg_catalog.btrim(p_emotion),
        pg_catalog.btrim(p_content),
        COALESCE(p_is_anon, true),
        'open'::public.peer_ticket_status,
        pg_catalog.now(),
        pg_catalog.now()
    )
    RETURNING * INTO v_ticket;

    RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_create(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_create(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.peer_ticket_claim(
    p_ticket_id UUID,
    p_relawan_id UUID
)
RETURNS public.peer_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets;
    v_relawan_role public.user_role;
    v_relawan_status public.account_status;
    v_daily_limit INTEGER;
    v_max_carry_penalty INTEGER;
    v_today DATE;
    v_yesterday DATE;
    v_yesterday_consumed INTEGER;
    v_carry_penalty INTEGER := 0;
    v_quota public.relawan_daily_quota%ROWTYPE;
    v_consumed INTEGER;
BEGIN
    IF p_ticket_id IS NULL OR p_relawan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING MESSAGE = 'ID tiket dan ID relawan wajib diisi.';
    END IF;

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_ticket.id IS NULL OR v_ticket.status <> 'open'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_AVAILABLE' USING MESSAGE = 'Tiket tidak tersedia atau sudah diambil relawan lain.';
    END IF;

    IF p_relawan_id = ANY(v_ticket.abandoned_by) THEN
        RAISE EXCEPTION 'TICKET_PREVIOUSLY_ABANDONED' USING MESSAGE = 'Relawan tidak dapat mengklaim tiket yang pernah ditinggalkan.';
    END IF;

    SELECT role, status INTO v_relawan_role, v_relawan_status
    FROM public.users
    WHERE id = p_relawan_id;

    IF v_relawan_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING MESSAGE = 'Relawan tidak ditemukan.';
    END IF;

    IF v_relawan_role <> 'relawan'::public.user_role OR v_relawan_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'FORBIDDEN_ROLE' USING MESSAGE = 'Hanya relawan aktif yang dapat mengklaim tiket curhat.';
    END IF;

    SELECT
        COALESCE(
            (value->>'daily_ticket_quota')::INTEGER,
            (value->'relawan'->>'daily_ticket_quota')::INTEGER,
            3
        ),
        COALESCE(
            (value->>'max_carry_penalty')::INTEGER,
            (value->'relawan'->>'max_carry_penalty')::INTEGER,
            1
        )
    INTO v_daily_limit, v_max_carry_penalty
    FROM public.system_settings
    WHERE key = 'relawan';

    v_daily_limit := COALESCE(v_daily_limit, 3);
    v_max_carry_penalty := COALESCE(v_max_carry_penalty, 1);
    v_today := (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_yesterday := v_today - 1;

    SELECT COALESCE(tickets_claimed, 0) + COALESCE(penalty_points, 0)
    INTO v_yesterday_consumed
    FROM public.relawan_daily_quota
    WHERE relawan_id = p_relawan_id AND quota_date = v_yesterday;

    v_yesterday_consumed := COALESCE(v_yesterday_consumed, 0);
    IF v_yesterday_consumed > v_daily_limit THEN
        v_carry_penalty := pg_catalog.least(v_yesterday_consumed - v_daily_limit, v_max_carry_penalty);
    ELSE
        v_carry_penalty := 0;
    END IF;

    INSERT INTO public.relawan_daily_quota (
        relawan_id,
        quota_date,
        tickets_claimed,
        penalty_points
    )
    VALUES (
        p_relawan_id,
        v_today,
        0,
        0
    )
    ON CONFLICT (relawan_id, quota_date) DO NOTHING;

    SELECT * INTO v_quota
    FROM public.relawan_daily_quota
    WHERE relawan_id = p_relawan_id AND quota_date = v_today
    FOR UPDATE;

    v_consumed := COALESCE(v_quota.tickets_claimed, 0) + COALESCE(v_quota.penalty_points, 0) + v_carry_penalty;
    IF v_consumed >= v_daily_limit THEN
        RAISE EXCEPTION 'DAILY_QUOTA_EXHAUSTED' USING MESSAGE = 'Kuota klaim tiket harian relawan sudah habis.';
    END IF;

    UPDATE public.relawan_daily_quota
    SET tickets_claimed = public.relawan_daily_quota.tickets_claimed + 1
    WHERE relawan_id = p_relawan_id AND quota_date = v_today;

    UPDATE public.peer_tickets
    SET
        status = 'claimed'::public.peer_ticket_status,
        claimed_by = p_relawan_id,
        claimed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_claim(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_claim(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.peer_ticket_first_response(
    p_ticket_id UUID,
    p_relawan_id UUID
)
RETURNS public.peer_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ticket public.peer_tickets;
    v_response_limit_mins INTEGER;
    v_claim_date DATE;
    v_new_abandoned UUID[];
BEGIN
    IF p_ticket_id IS NULL OR p_relawan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING MESSAGE = 'ID tiket dan ID relawan wajib diisi.';
    END IF;

    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_ticket.id IS NULL OR v_ticket.status <> 'claimed'::public.peer_ticket_status OR v_ticket.claimed_by <> p_relawan_id THEN
        RAISE EXCEPTION 'INVALID_TICKET_STATE' USING MESSAGE = 'Status tiket tidak valid untuk respon pertama.';
    END IF;

    SELECT COALESCE(
        (value->>'claim_response_minutes')::INTEGER,
        (value->'relawan'->>'claim_response_minutes')::INTEGER,
        10
    )
    INTO v_response_limit_mins
    FROM public.system_settings
    WHERE key = 'relawan';

    v_response_limit_mins := COALESCE(v_response_limit_mins, 10);

    IF pg_catalog.now() > v_ticket.claimed_at + (v_response_limit_mins * interval '1 minute') THEN
        IF NOT (p_relawan_id = ANY(v_ticket.abandoned_by)) THEN
            v_new_abandoned := pg_catalog.array_append(v_ticket.abandoned_by, p_relawan_id);
        ELSE
            v_new_abandoned := v_ticket.abandoned_by;
        END IF;

        v_claim_date := (v_ticket.claimed_at AT TIME ZONE 'Asia/Jakarta')::DATE;

        INSERT INTO public.relawan_daily_quota (
            relawan_id,
            quota_date,
            tickets_claimed,
            penalty_points
        )
        VALUES (
            p_relawan_id,
            v_claim_date,
            0,
            1
        )
        ON CONFLICT (relawan_id, quota_date)
        DO UPDATE SET
            penalty_points = public.relawan_daily_quota.penalty_points + 1;

        UPDATE public.peer_tickets
        SET
            status = 'open'::public.peer_ticket_status,
            claimed_by = NULL,
            claimed_at = NULL,
            abandoned_by = v_new_abandoned,
            updated_at = pg_catalog.now()
        WHERE id = p_ticket_id
        RETURNING * INTO v_ticket;

        RETURN v_ticket;
    END IF;

    UPDATE public.peer_tickets
    SET
        status = 'active'::public.peer_ticket_status,
        first_response_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_first_response(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_first_response(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.peer_ticket_tick()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_response_mins INTEGER;
    v_archive_hours INTEGER;
    v_timeout_count INTEGER := 0;
    v_archived_count INTEGER := 0;
    r_ticket public.peer_tickets%ROWTYPE;
    v_claim_date DATE;
    v_new_abandoned UUID[];
BEGIN
    SELECT
        COALESCE(
            (value->>'claim_response_minutes')::INTEGER,
            (value->'relawan'->>'claim_response_minutes')::INTEGER,
            10
        ),
        COALESCE(
            (value->>'unclaimed_archive_hours')::INTEGER,
            (value->'relawan'->>'unclaimed_archive_hours')::INTEGER,
            24
        )
    INTO v_response_mins, v_archive_hours
    FROM public.system_settings
    WHERE key = 'relawan';

    v_response_mins := COALESCE(v_response_mins, 10);
    v_archive_hours := COALESCE(v_archive_hours, 24);

    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'claimed'::public.peer_ticket_status
          AND claimed_at IS NOT NULL
          AND claimed_at + (v_response_mins * interval '1 minute') < pg_catalog.now()
        FOR UPDATE SKIP LOCKED
    LOOP
        IF r_ticket.claimed_by IS NOT NULL THEN
            v_claim_date := (r_ticket.claimed_at AT TIME ZONE 'Asia/Jakarta')::DATE;

            INSERT INTO public.relawan_daily_quota (
                relawan_id,
                quota_date,
                tickets_claimed,
                penalty_points
            )
            VALUES (
                r_ticket.claimed_by,
                v_claim_date,
                0,
                1
            )
            ON CONFLICT (relawan_id, quota_date)
            DO UPDATE SET
                penalty_points = public.relawan_daily_quota.penalty_points + 1;

            IF NOT (r_ticket.claimed_by = ANY(r_ticket.abandoned_by)) THEN
                v_new_abandoned := pg_catalog.array_append(r_ticket.abandoned_by, r_ticket.claimed_by);
            ELSE
                v_new_abandoned := r_ticket.abandoned_by;
            END IF;
        ELSE
            v_new_abandoned := r_ticket.abandoned_by;
        END IF;

        UPDATE public.peer_tickets
        SET
            status = 'open'::public.peer_ticket_status,
            claimed_by = NULL,
            claimed_at = NULL,
            abandoned_by = v_new_abandoned,
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_timeout_count := v_timeout_count + 1;
    END LOOP;

    FOR r_ticket IN
        SELECT *
        FROM public.peer_tickets
        WHERE status = 'open'::public.peer_ticket_status
          AND created_at + (v_archive_hours * interval '1 hour') < pg_catalog.now()
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.peer_tickets
        SET
            status = 'archived'::public.peer_ticket_status,
            archived_at = pg_catalog.now(),
            updated_at = pg_catalog.now()
        WHERE id = r_ticket.id;

        v_archived_count := v_archived_count + 1;
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'timeout_count', v_timeout_count,
        'archived_count', v_archived_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.peer_ticket_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_ticket_tick() TO service_role;

-- ========================================================
-- 4. SUITE PENGUJIAN SKENARIO & ASSERTIONS
-- ========================================================

DO $$
DECLARE
    v_t1 public.peer_tickets;
    v_t2 public.peer_tickets;
    v_t3 public.peer_tickets;
    v_t4 public.peer_tickets;
    v_t5 public.peer_tickets;
    v_t6 public.peer_tickets;
    v_t7 public.peer_tickets;
    v_t8 public.peer_tickets;
    v_t9 public.peer_tickets;
    v_t_claimed public.peer_tickets;
    v_threw BOOLEAN;
    v_quota public.relawan_daily_quota%ROWTYPE;
    v_tick_res JSONB;
    v_count INTEGER;
    v_today DATE := (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::DATE;
BEGIN
    -- UJI 1: Create tiket pasien 1 -> berhasil status 'open'
    v_t1 := public.peer_ticket_create(
        'a1000000-0000-0000-0000-000000000001',
        'Bunga Biru',
        'Kesepian',
        'Merasa Kesepian',
        'Butuh teman cerita tanpa menghakimi karena akhir-akhir ini terasa berat.',
        true
    );

    ASSERT v_t1.id IS NOT NULL, 'UJI 1 GAGAL: ID tiket tidak ter-generate';
    ASSERT v_t1.status = 'open'::public.peer_ticket_status, 'UJI 1 GAGAL: status awal bukan open';
    ASSERT v_t1.patient_id = 'a1000000-0000-0000-0000-000000000001', 'UJI 1 GAGAL: patient_id salah';
    ASSERT v_t1.patient_alias = 'Bunga Biru', 'UJI 1 GAGAL: patient_alias salah';
    ASSERT v_t1.claimed_by IS NULL, 'UJI 1 GAGAL: claimed_by harus NULL';
    ASSERT v_t1.claimed_at IS NULL, 'UJI 1 GAGAL: claimed_at harus NULL';
    ASSERT v_t1.first_response_at IS NULL, 'UJI 1 GAGAL: first_response_at harus NULL';

    -- UJI 2: Pasien 1 mencoba membuat tiket kedua saat tiket 1 masih open -> ACTIVE_TICKET_EXISTS
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_create(
            'a1000000-0000-0000-0000-000000000001',
            'Bunga Biru 2',
            'Kecemasan',
            'Cemas',
            'Mencoba membuat tiket kedua padahal tiket pertama masih aktif.',
            true
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%ACTIVE_TICKET_EXISTS%' OR SQLERRM LIKE '%aktif%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 2 GAGAL: Pasien seharusnya ditolak membuat tiket ganda aktif';

    -- UJI 3: Pengguna non-pasien (psikolog) membuat tiket -> FORBIDDEN_ROLE
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_create(
            'a4000000-0000-0000-0000-000000000001',
            'Bukan Pasien',
            'Topik Test',
            'Emosi Test',
            'Mencoba membuat tiket dengan role selain pasien...',
            true
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%FORBIDDEN_ROLE%' OR SQLERRM LIKE '%Hanya pasien%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 3 GAGAL: Non-pasien seharusnya ditolak membuat tiket';

    -- UJI 4: Relawan 1 mengklaim tiket 1 -> status 'claimed', quota tickets_claimed bertambah 1
    v_t_claimed := public.peer_ticket_claim(
        v_t1.id,
        'a2000000-0000-0000-0000-000000000001'
    );
    ASSERT v_t_claimed.status = 'claimed'::public.peer_ticket_status, 'UJI 4 GAGAL: status bukan claimed';
    ASSERT v_t_claimed.claimed_by = 'a2000000-0000-0000-0000-000000000001', 'UJI 4 GAGAL: claimed_by bukan Relawan 1';
    ASSERT v_t_claimed.claimed_at IS NOT NULL, 'UJI 4 GAGAL: claimed_at tidak terisi';

    SELECT * INTO v_quota
    FROM public.relawan_daily_quota
    WHERE relawan_id = 'a2000000-0000-0000-0000-000000000001' AND quota_date = v_today;
    ASSERT v_quota.tickets_claimed = 1, format('UJI 4 GAGAL: tickets_claimed harus 1, dapat %s', v_quota.tickets_claimed);

    -- UJI 5: Relawan 2 mencoba mengklaim tiket yang sudah berstatus claimed -> TICKET_NOT_AVAILABLE
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_claim(
            v_t1.id,
            'a2000000-0000-0000-0000-000000000002'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%TICKET_NOT_AVAILABLE%' OR SQLERRM LIKE '%tidak tersedia%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 5 GAGAL: Klaim tiket yang sudah claimed seharusnya ditolak';

    -- UJI 6: Penegakan kuota harian relawan (maksimal 3 tiket/hari)
    -- Relawan 1 sudah mengklaim 1 tiket (v_t1). Buat tiket 2 dan klaim oleh Relawan 1 -> klaim ke-2
    v_t2 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000002', 'Bunga Mawar', 'Stres', 'Tertekan', 'Beban kerja dan skripsi menumpuk sekali...', true);
    PERFORM public.peer_ticket_claim(v_t2.id, 'a2000000-0000-0000-0000-000000000001');

    -- Buat tiket 3 dan klaim oleh Relawan 1 -> klaim ke-3 (kuota habis)
    v_t3 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000003', 'Daun Hijau', 'Keluarga', 'Sedih', 'Konflik dengan orang tua di rumah...', true);
    PERFORM public.peer_ticket_claim(v_t3.id, 'a2000000-0000-0000-0000-000000000001');

    SELECT * INTO v_quota
    FROM public.relawan_daily_quota
    WHERE relawan_id = 'a2000000-0000-0000-0000-000000000001' AND quota_date = v_today;
    ASSERT v_quota.tickets_claimed = 3, format('UJI 6a GAGAL: tickets_claimed harus 3, dapat %s', v_quota.tickets_claimed);

    -- Buat tiket 4, Relawan 1 mencoba klaim ke-4 -> DAILY_QUOTA_EXHAUSTED
    v_t4 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000004', 'Langit Sore', 'Pertemanan', 'Kecewa', 'Dikhianati oleh sahabat dekat sendiri...', true);
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_claim(v_t4.id, 'a2000000-0000-0000-0000-000000000001');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%DAILY_QUOTA_EXHAUSTED%' OR SQLERRM LIKE '%habis%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 6b GAGAL: Klaim tiket melebihi kuota 3 tiket seharusnya ditolak';

    -- UJI 7: First response tepat waktu pada tiket 1 -> status menjadi 'active'
    v_t_claimed := public.peer_ticket_first_response(
        v_t1.id,
        'a2000000-0000-0000-0000-000000000001'
    );
    ASSERT v_t_claimed.status = 'active'::public.peer_ticket_status, 'UJI 7 GAGAL: status bukan active';
    ASSERT v_t_claimed.first_response_at IS NOT NULL, 'UJI 7 GAGAL: first_response_at tidak terisi';

    -- UJI 8: First response timeout (>10 menit) pada tiket 2
    -- Simulasikan claimed_at 15 menit yang lalu
    UPDATE public.peer_tickets
    SET claimed_at = pg_catalog.now() - interval '15 minutes'
    WHERE id = v_t2.id;

    -- Panggil peer_ticket_first_response: TIDAK boleh melempar exception, melainkan return tiket open
    v_t2 := public.peer_ticket_first_response(
        v_t2.id,
        'a2000000-0000-0000-0000-000000000001'
    );
    ASSERT v_t2.status = 'open'::public.peer_ticket_status, 'UJI 8a GAGAL: First response timeout harus return status open';
    ASSERT v_t2.claimed_by IS NULL, 'UJI 8b GAGAL: return claimed_by harus NULL';
    ASSERT 'a2000000-0000-0000-0000-000000000001'::uuid = ANY(v_t2.abandoned_by), 'UJI 8c GAGAL: return abandoned_by harus memuat Relawan 1';

    -- Cek tiket 2 di DB kembali open, claimed_by NULL, Relawan 1 masuk abandoned_by
    SELECT * INTO v_t2 FROM public.peer_tickets WHERE id = v_t2.id;
    ASSERT v_t2.status = 'open'::public.peer_ticket_status, 'UJI 8d GAGAL: tiket timeout di DB harus open';
    ASSERT v_t2.claimed_by IS NULL, 'UJI 8e GAGAL: claimed_by di DB harus NULL';
    ASSERT 'a2000000-0000-0000-0000-000000000001'::uuid = ANY(v_t2.abandoned_by), 'UJI 8f GAGAL: Relawan 1 harus tercatat di abandoned_by di DB';

    -- Cek penalty_points Relawan 1 bertambah 1
    SELECT * INTO v_quota
    FROM public.relawan_daily_quota
    WHERE relawan_id = 'a2000000-0000-0000-0000-000000000001' AND quota_date = v_today;
    ASSERT v_quota.penalty_points = 1, format('UJI 8g GAGAL: penalty_points harus 1, dapat %s', v_quota.penalty_points);

    -- UJI 9: Relawan 1 mencoba mengklaim kembali tiket 2 yang pernah ditinggalkan -> TICKET_PREVIOUSLY_ABANDONED
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_claim(
            v_t2.id,
            'a2000000-0000-0000-0000-000000000001'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%TICKET_PREVIOUSLY_ABANDONED%' OR SQLERRM LIKE '%ditinggalkan%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 9 GAGAL: Relawan tidak boleh mengklaim tiket yang pernah ditinggalkan';

    -- UJI 10: Background worker peer_ticket_tick() menangani tiket claimed timeout
    -- Tiket 4 diklaim oleh Relawan 2
    PERFORM public.peer_ticket_claim(v_t4.id, 'a2000000-0000-0000-0000-000000000002');
    -- Simulasikan klaim terjadi 12 menit yang lalu (> 10 menit)
    UPDATE public.peer_tickets
    SET claimed_at = pg_catalog.now() - interval '12 minutes'
    WHERE id = v_t4.id;

    v_tick_res := public.peer_ticket_tick();
    ASSERT (v_tick_res->>'timeout_count')::int >= 1,
        format('UJI 10a GAGAL: timeout_count harus >= 1, hasil: %s', v_tick_res);

    SELECT * INTO v_t4 FROM public.peer_tickets WHERE id = v_t4.id;
    ASSERT v_t4.status = 'open'::public.peer_ticket_status, 'UJI 10b GAGAL: tiket 4 harus kembali open setelah tick';
    ASSERT v_t4.claimed_by IS NULL, 'UJI 10c GAGAL: claimed_by harus NULL setelah tick';
    ASSERT 'a2000000-0000-0000-0000-000000000002'::uuid = ANY(v_t4.abandoned_by), 'UJI 10d GAGAL: Relawan 2 harus di abandoned_by';

    SELECT * INTO v_quota
    FROM public.relawan_daily_quota
    WHERE relawan_id = 'a2000000-0000-0000-0000-000000000002' AND quota_date = v_today;
    ASSERT v_quota.penalty_points = 1, format('UJI 10e GAGAL: penalty_points Relawan 2 harus 1, dapat %s', v_quota.penalty_points);

    -- UJI 11: Background worker peer_ticket_tick() mengarsipkan tiket open yang > 24 jam
    v_t5 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000005', 'Bintang Malam', 'Overthinking', 'Gelisah', 'Sulit tidur memikirkan masa depan...', true);
    -- Simulasikan tiket dibuat 25 jam yang lalu
    UPDATE public.peer_tickets
    SET created_at = pg_catalog.now() - interval '25 hours'
    WHERE id = v_t5.id;

    v_tick_res := public.peer_ticket_tick();
    ASSERT (v_tick_res->>'archived_count')::int >= 1,
        format('UJI 11a GAGAL: archived_count harus >= 1, hasil: %s', v_tick_res);

    SELECT * INTO v_t5 FROM public.peer_tickets WHERE id = v_t5.id;
    ASSERT v_t5.status = 'archived'::public.peer_ticket_status, 'UJI 11b GAGAL: status tiket 5 harus archived';
    ASSERT v_t5.archived_at IS NOT NULL, 'UJI 11c GAGAL: archived_at harus terisi';

    -- UJI 12: Pasien 5 dapat membuat tiket baru setelah tiket sebelumnya diarsipkan (partial unique index)
    v_t6 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000005', 'Bintang Fajar', 'Semangat Baru', 'Tenang', 'Sudah merasa lebih tenang dan ingin ngobrol santai...', true);
    ASSERT v_t6.id IS NOT NULL, 'UJI 12 GAGAL: Pasien 5 harus bisa membuat tiket baru saat tiket lama archived';
    ASSERT v_t6.status = 'open'::public.peer_ticket_status, 'UJI 12 GAGAL: status tiket baru harus open';

    -- UJI 13: Penegakan kuota carry penalty hari kemarin (maksimal 1 poin)
    -- Simulasikan kuota kemarin untuk Relawan 3: 3 klaim + 1 penalti (total 4, selisih 1 -> carry penalty = 1)
    INSERT INTO public.relawan_daily_quota (relawan_id, quota_date, tickets_claimed, penalty_points)
    VALUES ('a2000000-0000-0000-0000-000000000003', v_today - 1, 3, 1)
    ON CONFLICT (relawan_id, quota_date) DO UPDATE SET tickets_claimed = 3, penalty_points = 1;

    -- Buat 3 tiket baru dari Pasien 7, 8, 9
    v_t7 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000007', 'Kuntum Melati', 'Karier', 'Bingung', 'Bingung memilih arah karier masa depan...', true);
    v_t8 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000008', 'Anggrek Ungu', 'Pekerjaan', 'Burnout', 'Merasa burnout dengan rutinitas kantor...', true);
    v_t9 := public.peer_ticket_create('a1000000-0000-0000-0000-000000000009', 'Tulip Kuning', 'Pendidikan', 'Stres', 'Tekanan ujian akhir semester berat...', true);

    -- Klaim 1 Relawan 3 berhasil (konsumsi: 1 tiket + 1 carry penalty = 2 <= 3)
    PERFORM public.peer_ticket_claim(v_t7.id, 'a2000000-0000-0000-0000-000000000003');

    -- Klaim 2 Relawan 3 berhasil (konsumsi: 2 tiket + 1 carry penalty = 3 <= 3)
    PERFORM public.peer_ticket_claim(v_t8.id, 'a2000000-0000-0000-0000-000000000003');

    -- Klaim 3 Relawan 3 ditolak DAILY_QUOTA_EXHAUSTED (kuota 3 terpotong 1 carry penalty, jatah hari ini hanya 2)
    v_threw := false;
    BEGIN
        PERFORM public.peer_ticket_claim(v_t9.id, 'a2000000-0000-0000-0000-000000000003');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%DAILY_QUOTA_EXHAUSTED%' OR SQLERRM LIKE '%habis%' THEN
            v_threw := true;
        END IF;
    END;
    ASSERT v_threw = true, 'UJI 13 GAGAL: Relawan dengan carry penalty kemarin seharusnya ditolak pada klaim ke-3';

    RAISE NOTICE 'SKENARIO BISNIS 1-13 LULUS.';
END $$;

-- ========================================================
-- 5. UJI ROW LEVEL SECURITY (RLS)
-- ========================================================

-- UJI RLS 1: Pasien 1 hanya melihat tiket miliknya sendiri
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_tickets;
    ASSERT v_count = 1, format('UJI RLS 1 GAGAL: Pasien 1 seharusnya melihat tepat 1 tiket miliknya, ditemukan %s', v_count);
END $$;

RESET ROLE;

-- UJI RLS 2: Relawan 1 (aktif) TIDAK dapat membaca tabel peer_tickets secara langsung (privasi patient_id)
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_tickets;
    ASSERT v_count = 0, format('UJI RLS 2 GAGAL: Relawan seharusnya tidak dapat membaca tabel peer_tickets secara langsung (0 baris), ditemukan %s baris', v_count);
END $$;

RESET ROLE;

-- UJI RLS 3: Admin melihat seluruh tiket
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.peer_tickets;
    ASSERT v_count >= 5, format('UJI RLS 3 GAGAL: Admin harus melihat semua tiket (ditemukan %s)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 4: Mutasi langsung (INSERT/UPDATE/DELETE) pada peer_tickets ditolak untuk authenticated
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.peer_tickets (patient_id, patient_alias, topic, emotion, content)
        VALUES ('a1000000-0000-0000-0000-000000000001', 'Direct Insert', 'Test', 'Test', 'Percobaan insert langsung...');
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI RLS 4 GAGAL: INSERT langsung ke peer_tickets seharusnya ditolak hak akses';
END $$;

RESET ROLE;

-- UJI RLS 5: Relawan 1 hanya melihat relawan_daily_quota miliknya sendiri
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.relawan_daily_quota;
    ASSERT v_count = 1, format('UJI RLS 5 GAGAL: Relawan 1 hanya boleh melihat kuota miliknya sendiri (ditemukan %s baris)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 6: Admin dapat membaca semua baris relawan_daily_quota
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.relawan_daily_quota;
    ASSERT v_count >= 2, format('UJI RLS 6 GAGAL: Admin harus melihat semua baris kuota (ditemukan %s)', v_count);
END $$;

RESET ROLE;

-- UJI RLS 7: Mutasi langsung pada relawan_daily_quota ditolak untuk authenticated
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
END $$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        UPDATE public.relawan_daily_quota SET tickets_claimed = 0;
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
    END;
    ASSERT v_threw = true, 'UJI RLS 7 GAGAL: UPDATE langsung ke relawan_daily_quota seharusnya ditolak hak akses';
END $$;

RESET ROLE;

RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN PEER TICKETS LULUS.';

-- ========================================================
-- ROLLBACK UNTUK MENJAGA DATABASE TEST TETAP BERSIH
-- ========================================================
ROLLBACK;
