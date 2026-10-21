-- ========================================================
-- TEMAN BICARA: SISTEM TIKET CURHAT SEBAYA & KUOTA RELAWAN (PRD-006)
-- Migration: 20261021000020_peer_tickets.sql
-- ========================================================

-- 1. ENUM STATUS TIKET CURHAT SEBAYA
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'peer_ticket_status') THEN
        CREATE TYPE public.peer_ticket_status AS ENUM ('open', 'claimed', 'active', 'closed', 'archived');
    END IF;
END $$;

COMMENT ON TYPE public.peer_ticket_status IS 'Siklus status tiket curhat: open (antrean pool), claimed (diambil relawan), active (sesi chat berjalan), closed (selesai), archived (kedaluwarsa 24 jam)';

-- 2. TABEL PEER_TICKETS
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

COMMENT ON TABLE public.peer_tickets IS 'Tabel tiket curhat sebaya pasien untuk diklaim dan didampingi oleh relawan';
COMMENT ON COLUMN public.peer_tickets.id IS 'Primary key UUID tiket';
COMMENT ON COLUMN public.peer_tickets.patient_id IS 'ID pengguna pasien pemilik tiket';
COMMENT ON COLUMN public.peer_tickets.patient_alias IS 'Nama samaran pasien untuk privasi';
COMMENT ON COLUMN public.peer_tickets.topic IS 'Topik curhat pasien';
COMMENT ON COLUMN public.peer_tickets.emotion IS 'Kondisi emosi/perasaan pasien saat membuat tiket';
COMMENT ON COLUMN public.peer_tickets.content IS 'Isi cerita curhat pasien';
COMMENT ON COLUMN public.peer_tickets.is_anonymous IS 'Apakah menggunakan nama samaran';
COMMENT ON COLUMN public.peer_tickets.status IS 'Status siklus tiket curhat';
COMMENT ON COLUMN public.peer_tickets.claimed_by IS 'ID relawan yang mengklaim tiket';
COMMENT ON COLUMN public.peer_tickets.claimed_at IS 'Waktu relawan mengklaim tiket';
COMMENT ON COLUMN public.peer_tickets.first_response_at IS 'Waktu relawan mengirim balasan pertama di room';
COMMENT ON COLUMN public.peer_tickets.closed_at IS 'Waktu tiket ditutup oleh pasien atau relawan';
COMMENT ON COLUMN public.peer_tickets.archived_at IS 'Waktu tiket diarsipkan otomatis jika 24 jam tidak diklaim';
COMMENT ON COLUMN public.peer_tickets.abandoned_by IS 'Daftar relawan yang pernah mengklaim tiket lalu timeout';
COMMENT ON COLUMN public.peer_tickets.created_at IS 'Waktu pembuatan tiket';
COMMENT ON COLUMN public.peer_tickets.updated_at IS 'Waktu pembaruan tiket terakhir';

-- Indeks partial unique: Maksimal 1 tiket aktif (open, claimed, active) per pasien di level DB
CREATE UNIQUE INDEX IF NOT EXISTS peer_tickets_active_patient_idx
    ON public.peer_tickets(patient_id)
    WHERE status IN ('open', 'claimed', 'active');

CREATE INDEX IF NOT EXISTS idx_peer_tickets_status ON public.peer_tickets(status);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_patient_id ON public.peer_tickets(patient_id);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_claimed_by ON public.peer_tickets(claimed_by);
CREATE INDEX IF NOT EXISTS idx_peer_tickets_created_at ON public.peer_tickets(created_at);

-- 3. TABEL RELAWAN_DAILY_QUOTA
CREATE TABLE IF NOT EXISTS public.relawan_daily_quota (
    relawan_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quota_date DATE NOT NULL,
    tickets_claimed INT NOT NULL DEFAULT 0 CHECK (tickets_claimed >= 0),
    penalty_points INT NOT NULL DEFAULT 0 CHECK (penalty_points >= 0),
    PRIMARY KEY (relawan_id, quota_date)
);

COMMENT ON TABLE public.relawan_daily_quota IS 'Pencatatan konsumsi kuota tiket harian dan penalti timeout relawan sebaya (zona WIB)';
COMMENT ON COLUMN public.relawan_daily_quota.relawan_id IS 'ID pengguna relawan';
COMMENT ON COLUMN public.relawan_daily_quota.quota_date IS 'Tanggal kuota dalam zona Asia/Jakarta (WIB)';
COMMENT ON COLUMN public.relawan_daily_quota.tickets_claimed IS 'Jumlah tiket yang berhasil diklaim hari ini';
COMMENT ON COLUMN public.relawan_daily_quota.penalty_points IS 'Poin penalti karena klaim timeout tanpa respons';

CREATE INDEX IF NOT EXISTS idx_relawan_daily_quota_date ON public.relawan_daily_quota(quota_date);

-- 4. ROW LEVEL SECURITY (RLS) & HAK AKSES
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

-- 5. REALTIME PUBLICATION
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_tickets;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 6. RPC: peer_ticket_create
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
    -- 1. Validasi parameter
    IF p_patient_id IS NULL
       OR p_alias IS NULL OR pg_catalog.btrim(p_alias) = ''
       OR p_topic IS NULL OR pg_catalog.btrim(p_topic) = ''
       OR p_emotion IS NULL OR pg_catalog.btrim(p_emotion) = ''
       OR p_content IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_content)) < 10 THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    -- 2. Verifikasi pengguna di public.users (harus pasien aktif)
    SELECT role, status INTO v_user_role, v_user_status
    FROM public.users
    WHERE id = p_patient_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_user_role <> 'pasien'::public.user_role OR v_user_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = '42501';
    END IF;

    -- 3. Cek tiket aktif yang sudah ada (open, claimed, atau active)
    IF EXISTS (
        SELECT 1 FROM public.peer_tickets
        WHERE patient_id = p_patient_id
          AND status IN ('open'::public.peer_ticket_status, 'claimed'::public.peer_ticket_status, 'active'::public.peer_ticket_status)
    ) THEN
        RAISE EXCEPTION 'ACTIVE_TICKET_EXISTS' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Simpan tiket baru
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

-- 7. RPC: peer_ticket_claim
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
    -- 1. Validasi parameter input
    IF p_ticket_id IS NULL OR p_relawan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    -- 2. Kunci baris tiket dan cek ketersediaan
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_ticket.id IS NULL OR v_ticket.status <> 'open'::public.peer_ticket_status THEN
        RAISE EXCEPTION 'TICKET_NOT_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    -- 3. Periksa riwayat abandoned
    IF p_relawan_id = ANY(v_ticket.abandoned_by) THEN
        RAISE EXCEPTION 'TICKET_PREVIOUSLY_ABANDONED' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Verifikasi pengguna relawan di public.users
    SELECT role, status INTO v_relawan_role, v_relawan_status
    FROM public.users
    WHERE id = p_relawan_id;

    IF v_relawan_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_relawan_role <> 'relawan'::public.user_role OR v_relawan_status <> 'active'::public.account_status THEN
        RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = '42501';
    END IF;

    -- 5. Baca kuota harian & batas carry penalty dari system_settings
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

    -- 6. Tanggal hari ini zona WIB (Asia/Jakarta) & kemarin
    v_today := (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_yesterday := v_today - 1;

    -- 7. Hitung penalti terbawa (carry penalty) dari hari kemarin
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

    -- 8. Pastikan baris kuota relawan ada dan kunci baris tersebut
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
        RAISE EXCEPTION 'DAILY_QUOTA_EXHAUSTED' USING ERRCODE = 'P0001';
    END IF;

    -- 9. Tambah tickets_claimed relawan
    UPDATE public.relawan_daily_quota
    SET tickets_claimed = public.relawan_daily_quota.tickets_claimed + 1
    WHERE relawan_id = p_relawan_id AND quota_date = v_today;

    -- 10. Perbarui status tiket menjadi claimed
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

-- 8. RPC: peer_ticket_first_response
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
    -- 1. Validasi parameter
    IF p_ticket_id IS NULL OR p_relawan_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETER' USING ERRCODE = '22023';
    END IF;

    -- 2. Kunci baris tiket
    SELECT * INTO v_ticket
    FROM public.peer_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF v_ticket.id IS NULL OR v_ticket.status <> 'claimed'::public.peer_ticket_status OR v_ticket.claimed_by <> p_relawan_id THEN
        RAISE EXCEPTION 'INVALID_TICKET_STATE' USING ERRCODE = 'P0001';
    END IF;

    -- 3. Ambil konfigurasi batas waktu respon (menit)
    SELECT COALESCE(
        (value->>'claim_response_minutes')::INTEGER,
        (value->'relawan'->>'claim_response_minutes')::INTEGER,
        10
    )
    INTO v_response_limit_mins
    FROM public.system_settings
    WHERE key = 'relawan';

    v_response_limit_mins := COALESCE(v_response_limit_mins, 10);

    -- 4. Pengecekan timeout
    IF pg_catalog.now() > v_ticket.claimed_at + (v_response_limit_mins * interval '1 minute') THEN
        IF NOT (p_relawan_id = ANY(v_ticket.abandoned_by)) THEN
            v_new_abandoned := pg_catalog.array_append(v_ticket.abandoned_by, p_relawan_id);
        ELSE
            v_new_abandoned := v_ticket.abandoned_by;
        END IF;

        v_claim_date := (v_ticket.claimed_at AT TIME ZONE 'Asia/Jakarta')::DATE;

        -- Tambah penalty_points relawan
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

    -- 5. Respon tepat waktu: ubah status ke active
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

-- 9. RPC: peer_ticket_tick
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
    -- 1. Baca konfigurasi
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

    -- 2. Tangani tiket claimed yang timeout (> claim_response_minutes tanpa first response)
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

    -- 3. Arsipkan tiket open yang > 24 jam belum diklaim siapapun
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
