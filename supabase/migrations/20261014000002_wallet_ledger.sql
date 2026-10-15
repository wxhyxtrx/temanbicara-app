-- ========================================================
-- TEMAN BICARA: WALLET, APPEND-ONLY LEDGER, HOLDING, RPC UANG (FASE 2)
-- Eksekusi file ini di: Supabase Dashboard / CLI
-- Scope: wallets, ledger_entries, mitra_earnings, topup_orders, tips, payout_requests, RPCs
-- booking_hold / session_settle / booking_refund ditunda ke Fase 3.
-- Semua SECURITY DEFINER memakai search_path = '' dan nama objek fully qualified.
-- ========================================================

BEGIN;

-- 1. TABEL WALLETS
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
    coin_balance BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
    pending_rupiah BIGINT NOT NULL DEFAULT 0 CHECK (pending_rupiah >= 0),
    available_rupiah BIGINT NOT NULL DEFAULT 0 CHECK (available_rupiah >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- 2. TABEL LEDGER_ENTRIES (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    account TEXT NOT NULL CHECK (account IN ('patient_coins', 'mitra_pending', 'mitra_available', 'platform_revenue', 'payout_disbursement')),
    amount BIGINT NOT NULL CHECK (amount <> 0),
    unit TEXT NOT NULL CHECK (unit IN ('coin', 'rupiah')),
    reason TEXT NOT NULL,
    ref_type TEXT NOT NULL,
    ref_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT ledger_account_unit_ck CHECK (
        (account = 'patient_coins' AND unit = 'coin') OR
        (account IN ('mitra_pending', 'mitra_available', 'platform_revenue', 'payout_disbursement') AND unit = 'rupiah')
    ),
    CONSTRAINT ledger_account_owner_ck CHECK (
        (account IN ('platform_revenue', 'payout_disbursement') AND user_id IS NULL) OR
        (account IN ('patient_coins', 'mitra_pending', 'mitra_available') AND user_id IS NOT NULL)
    ),
    CONSTRAINT ledger_event_once UNIQUE (reason, ref_type, ref_id, account)
);

CREATE INDEX IF NOT EXISTS ledger_user_created_idx ON public.ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_ref_idx ON public.ledger_entries(ref_type, ref_id);

-- TRIGGER IMMUTABILITY LEDGER
CREATE OR REPLACE FUNCTION public.reject_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY' USING ERRCODE='55000';
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_immutable ON public.ledger_entries;
CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.reject_ledger_mutation();

REVOKE ALL ON FUNCTION public.reject_ledger_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- 3. TABEL MITRA_EARNINGS (HOLDING LIFECYCLE)
CREATE TABLE IF NOT EXISTS public.mitra_earnings (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount_rupiah BIGINT NOT NULL CHECK (amount_rupiah > 0),
    source_type TEXT NOT NULL CHECK (source_type IN ('tip', 'session', 'extension', 'refund_share')),
    source_id UUID NOT NULL,
    available_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT mitra_earning_source_once UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS mitra_earnings_release_idx ON public.mitra_earnings(available_at, id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS mitra_earnings_mitra_idx ON public.mitra_earnings(mitra_id, created_at DESC);

-- 4. TABEL TOPUP_ORDERS
CREATE TABLE IF NOT EXISTS public.topup_orders (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    coins BIGINT NOT NULL CHECK (coins > 0),
    amount_rupiah BIGINT NOT NULL CHECK (amount_rupiah > 0 AND amount_rupiah = coins * 10000),
    status public.payment_status NOT NULL DEFAULT 'pending'::public.payment_status,
    provider_reference TEXT UNIQUE,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS topup_orders_patient_idx ON public.topup_orders(patient_id, created_at DESC);

-- 5. TABEL TIPS
CREATE TABLE IF NOT EXISTS public.tips (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    coins BIGINT NOT NULL CHECK (coins > 0),
    mitra_share_bps INTEGER NOT NULL CHECK (mitra_share_bps BETWEEN 0 AND 10000),
    source_type TEXT NOT NULL CHECK (source_type IN ('session', 'ticket')),
    source_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT tips_source_once UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS tips_patient_created_idx ON public.tips(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tips_mitra_created_idx ON public.tips(mitra_id, created_at DESC);

-- 6. TABEL PAYOUT_REQUESTS
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount_rupiah BIGINT NOT NULL CHECK (amount_rupiah > 0),
    fee_rupiah BIGINT NOT NULL CHECK (fee_rupiah >= 0),
    bank_name TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(bank_name)) > 0),
    account_number TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(account_number)) > 0),
    bank_account_name TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(bank_account_name)) > 0),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS payout_mitra_status_idx ON public.payout_requests(mitra_id, status, requested_at DESC);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitra_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_owner_read ON public.wallets;
CREATE POLICY wallet_owner_read ON public.wallets FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ledger_owner_read ON public.ledger_entries;
CREATE POLICY ledger_owner_read ON public.ledger_entries FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS earnings_owner_read ON public.mitra_earnings;
CREATE POLICY earnings_owner_read ON public.mitra_earnings FOR SELECT TO authenticated
USING (mitra_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS topup_owner_read ON public.topup_orders;
CREATE POLICY topup_owner_read ON public.topup_orders FOR SELECT TO authenticated
USING (patient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tip_party_read ON public.tips;
CREATE POLICY tip_party_read ON public.tips FOR SELECT TO authenticated
USING (patient_id = (SELECT auth.uid()) OR mitra_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS payout_owner_read ON public.payout_requests;
CREATE POLICY payout_owner_read ON public.payout_requests FOR SELECT TO authenticated
USING (mitra_id = (SELECT auth.uid()));

-- 8. REVOKE TABEL MUTATION DARI SEMUA ROLE EKSTERNAL (TERMASUK SERVICE_ROLE)
-- Semua mutasi hanya melalui SECURITY DEFINER RPC
REVOKE ALL ON TABLE
    public.wallets,
    public.ledger_entries,
    public.mitra_earnings,
    public.topup_orders,
    public.tips,
    public.payout_requests
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
    public.wallets,
    public.ledger_entries,
    public.mitra_earnings,
    public.topup_orders,
    public.tips,
    public.payout_requests
TO authenticated, service_role;

-- 9. INTERNAL HELPER: apply_wallet_ledger_internal
-- REVOKE dari semua role API; hanya dipanggil oleh SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.apply_wallet_ledger_internal(
    p_user_id UUID,
    p_account TEXT,
    p_delta BIGINT,
    p_unit TEXT,
    p_reason TEXT,
    p_ref_type TEXT,
    p_ref_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_user_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;

    IF (p_account = 'patient_coins' AND (v_role <> 'pasien' OR p_unit <> 'coin')) OR
       (p_account IN ('mitra_pending', 'mitra_available') AND (v_role NOT IN ('psikolog', 'relawan') OR p_unit <> 'rupiah')) THEN
        RAISE EXCEPTION 'WALLET_ROLE_MISMATCH' USING ERRCODE='42501';
    END IF;

    INSERT INTO public.wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

    IF p_account = 'patient_coins' THEN
        IF v_wallet.coin_balance + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_COINS' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET coin_balance = coin_balance + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSIF p_account = 'mitra_pending' THEN
        IF v_wallet.pending_rupiah + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET pending_rupiah = pending_rupiah + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSIF p_account = 'mitra_available' THEN
        IF v_wallet.available_rupiah + p_delta < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE='P0001';
        END IF;
        UPDATE public.wallets
        SET available_rupiah = available_rupiah + p_delta,
            updated_at = pg_catalog.now()
        WHERE user_id = p_user_id;

    ELSE
        RAISE EXCEPTION 'INVALID_LEDGER_ACCOUNT' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES(p_user_id, p_account, p_delta, p_unit, p_reason, p_ref_type, p_ref_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_ledger_internal(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;

-- 10. RPC TOP-UP: topup_order_create
CREATE OR REPLACE FUNCTION public.topup_order_create(
    p_order_id TEXT,
    p_patient_id UUID,
    p_coins BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_min BIGINT;
    v_max BIGINT;
    v_id UUID;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_patient_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF p_order_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_order_id)) = 0 THEN
        RAISE EXCEPTION 'INVALID_ORDER_ID' USING ERRCODE='22023';
    END IF;

    SELECT (value->>'min_coins')::BIGINT, (value->>'max_coins')::BIGINT
    INTO v_min, v_max
    FROM public.system_settings
    WHERE key = 'topup';

    IF v_min IS NULL OR v_max IS NULL THEN
        RAISE EXCEPTION 'SETTING_TOPUP_INVALID' USING ERRCODE='22023';
    END IF;

    IF p_coins < v_min OR p_coins > v_max THEN
        RAISE EXCEPTION 'TOPUP_COINS_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.topup_orders (order_id, patient_id, coins, amount_rupiah, status)
    VALUES (p_order_id, p_patient_id, p_coins, p_coins * 10000, 'pending'::public.payment_status)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 11. RPC TOP-UP: topup_settle
CREATE OR REPLACE FUNCTION public.topup_settle(
    p_order_id TEXT,
    p_provider_reference TEXT,
    p_paid_amount_rupiah BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.topup_orders%ROWTYPE;
    v_role public.user_role;
BEGIN
    SELECT * INTO v_order
    FROM public.topup_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TOPUP_ORDER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = v_order.patient_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF v_order.status = 'settlement'::public.payment_status THEN
        RETURN FALSE;
    END IF;

    IF v_order.status <> 'pending'::public.payment_status THEN
        RAISE EXCEPTION 'TOPUP_NOT_SETTLEABLE' USING ERRCODE='P0001';
    END IF;

    IF p_paid_amount_rupiah IS NULL OR p_paid_amount_rupiah <> v_order.amount_rupiah THEN
        RAISE EXCEPTION 'TOPUP_AMOUNT_MISMATCH' USING ERRCODE='22023';
    END IF;

    PERFORM public.apply_wallet_ledger_internal(
        v_order.patient_id,
        'patient_coins',
        v_order.coins,
        'coin',
        'topup_settled',
        'topup_order',
        v_order.id
    );

    UPDATE public.topup_orders
    SET status = 'settlement'::public.payment_status,
        provider_reference = p_provider_reference,
        settled_at = pg_catalog.now()
    WHERE id = v_order.id;

    RETURN TRUE;
END;
$$;

-- 12. RPC TOP-UP: topup_fail
CREATE OR REPLACE FUNCTION public.topup_fail(
    p_order_id TEXT,
    p_status public.payment_status,
    p_provider_reference TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.topup_orders%ROWTYPE;
BEGIN
    IF p_status NOT IN ('deny'::public.payment_status, 'expire'::public.payment_status, 'cancel'::public.payment_status) THEN
        RAISE EXCEPTION 'INVALID_TOPUP_FAIL_STATUS' USING ERRCODE='22023';
    END IF;

    SELECT * INTO v_order
    FROM public.topup_orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TOPUP_ORDER_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    IF v_order.status = p_status THEN
        RETURN FALSE;
    END IF;

    IF v_order.status <> 'pending'::public.payment_status THEN
        RAISE EXCEPTION 'TOPUP_NOT_MUTABLE' USING ERRCODE='P0001';
    END IF;

    UPDATE public.topup_orders
    SET status = p_status,
        provider_reference = p_provider_reference
    WHERE id = v_order.id;

    RETURN TRUE;
END;
$$;

-- 13. RPC TIP: tip_create
CREATE OR REPLACE FUNCTION public.tip_create(
    p_tip_id UUID,
    p_patient_id UUID,
    p_mitra_id UUID,
    p_coins BIGINT,
    p_source_type TEXT,
    p_source_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_role public.user_role;
    v_mitra_role public.user_role;
    v_bps INTEGER;
    v_min BIGINT;
    v_max BIGINT;
    v_cap BIGINT;
    v_total BIGINT;
    v_gross BIGINT;
    v_mitra BIGINT;
    v_platform BIGINT;
    v_holding INTEGER;
BEGIN
    IF p_source_type IS NULL OR p_source_type NOT IN ('session', 'ticket') OR p_source_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_TIP_SOURCE' USING ERRCODE='22023';
    END IF;

    -- Advisory lock serializes cap check per patient per WIB day
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_patient_id::TEXT || pg_catalog.to_char(pg_catalog.now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'), 0)
    );

    v_patient_role := NULL;
    SELECT u.role INTO v_patient_role
    FROM public.users AS u
    WHERE u.id = p_patient_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_patient_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_patient_role <> 'pasien' THEN
        RAISE EXCEPTION 'PATIENT_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    v_mitra_role := NULL;
    SELECT u.role INTO v_mitra_role
    FROM public.users AS u
    WHERE u.id = p_mitra_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_mitra_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_mitra_role NOT IN ('psikolog', 'relawan') THEN
        RAISE EXCEPTION 'MITRA_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    SELECT (value->>'min_coins')::BIGINT, (value->>'max_coins')::BIGINT, (value->>'daily_cap_coins_per_patient')::BIGINT
    INTO v_min, v_max, v_cap
    FROM public.system_settings
    WHERE key = 'tip';

    IF v_min IS NULL OR v_max IS NULL OR v_cap IS NULL THEN
        RAISE EXCEPTION 'SETTING_TIP_INVALID' USING ERRCODE='22023';
    END IF;

    SELECT (value->>'mitra_bps')::INTEGER
    INTO v_bps
    FROM public.system_settings
    WHERE key = 'revenue_share';

    IF v_bps IS NULL THEN
        RAISE EXCEPTION 'SETTING_REVENUE_SHARE_INVALID' USING ERRCODE='22023';
    END IF;

    SELECT (value->>'hours')::INTEGER
    INTO v_holding
    FROM public.system_settings
    WHERE key = 'holding';

    IF v_holding IS NULL THEN
        RAISE EXCEPTION 'SETTING_HOLDING_INVALID' USING ERRCODE='22023';
    END IF;

    IF p_coins < v_min OR p_coins > v_max THEN
        RAISE EXCEPTION 'TIP_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;

    SELECT COALESCE(SUM(coins), 0)
    INTO v_total
    FROM public.tips
    WHERE patient_id = p_patient_id
      AND created_at >= (pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')
      AND created_at < ((pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta');

    IF v_total + p_coins > v_cap THEN
        RAISE EXCEPTION 'TIP_DAILY_CAP_EXCEEDED' USING ERRCODE='P0001';
    END IF;

    v_gross := p_coins * 10000;
    v_mitra := pg_catalog.floor((v_gross::NUMERIC * v_bps) / 10000.0)::BIGINT;
    v_platform := v_gross - v_mitra;

    IF v_mitra + v_platform <> v_gross THEN
        RAISE EXCEPTION 'TIP_CONSERVATION_FAILED' USING ERRCODE='23514';
    END IF;

    -- Inisialisasi wallets lalu lock terurut UUID ASC mencegah deadlock
    INSERT INTO public.wallets(user_id) VALUES(p_patient_id), (p_mitra_id) ON CONFLICT(user_id) DO NOTHING;
    PERFORM 1 FROM public.wallets WHERE user_id IN (p_patient_id, p_mitra_id) ORDER BY user_id FOR UPDATE;

    INSERT INTO public.tips(id, patient_id, mitra_id, coins, mitra_share_bps, source_type, source_id)
    VALUES(p_tip_id, p_patient_id, p_mitra_id, p_coins, v_bps, p_source_type, p_source_id);

    PERFORM public.apply_wallet_ledger_internal(p_patient_id, 'patient_coins', -p_coins, 'coin', 'tip_debit', 'tip', p_tip_id);

    UPDATE public.wallets
    SET pending_rupiah = pending_rupiah + v_mitra,
        updated_at = pg_catalog.now()
    WHERE user_id = p_mitra_id;

    INSERT INTO public.mitra_earnings(mitra_id, amount_rupiah, source_type, source_id, available_at)
    VALUES(p_mitra_id, v_mitra, 'tip', p_tip_id, pg_catalog.now() + v_holding * INTERVAL '1 hour');

    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES
        (p_mitra_id, 'mitra_pending', v_mitra, 'rupiah', 'tip_pending', 'tip', p_tip_id),
        (NULL, 'platform_revenue', v_platform, 'rupiah', 'tip_platform_share', 'tip', p_tip_id);
END;
$$;

-- 14. RPC PAYOUT: payout_request
CREATE OR REPLACE FUNCTION public.payout_request(
    p_payout_id UUID,
    p_mitra_id UUID,
    p_amount BIGINT,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_min BIGINT;
    v_max BIGINT;
    v_fee BIGINT;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_mitra_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role NOT IN ('psikolog', 'relawan') THEN
        RAISE EXCEPTION 'MITRA_ROLE_REQUIRED' USING ERRCODE='42501';
    END IF;

    IF p_bank_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_bank_name)) = 0 OR
       p_account_number IS NULL OR pg_catalog.length(pg_catalog.btrim(p_account_number)) = 0 OR
       p_account_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_account_name)) = 0 THEN
        RAISE EXCEPTION 'INVALID_BANK_DETAILS' USING ERRCODE='22023';
    END IF;

    SELECT (value->>'min_rupiah')::BIGINT, (value->>'max_rupiah')::BIGINT, (value->>'fee_rupiah')::BIGINT
    INTO v_min, v_max, v_fee
    FROM public.system_settings
    WHERE key = 'payout';

    IF v_min IS NULL OR v_max IS NULL OR v_fee IS NULL THEN
        RAISE EXCEPTION 'SETTING_PAYOUT_INVALID' USING ERRCODE='22023';
    END IF;

    IF p_amount < v_min OR p_amount > v_max THEN
        RAISE EXCEPTION 'PAYOUT_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.wallets(user_id) VALUES(p_mitra_id) ON CONFLICT(user_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_mitra_id FOR UPDATE;

    IF v_wallet.available_rupiah < p_amount + v_fee THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.payout_requests(
        id,
        mitra_id,
        amount_rupiah,
        fee_rupiah,
        bank_name,
        account_number,
        bank_account_name,
        status
    ) VALUES (
        p_payout_id,
        p_mitra_id,
        p_amount,
        v_fee,
        p_bank_name,
        p_account_number,
        p_account_name,
        'requested'
    );

    UPDATE public.wallets
    SET available_rupiah = available_rupiah - (p_amount + v_fee),
        updated_at = pg_catalog.now()
    WHERE user_id = p_mitra_id;

    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES (p_mitra_id, 'mitra_available', -(p_amount + v_fee), 'rupiah', 'payout_reserved', 'payout', p_payout_id);
END;
$$;

-- 15. RPC PAYOUT: payout_reject
CREATE OR REPLACE FUNCTION public.payout_reject(
    p_payout_id UUID,
    p_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v public.payout_requests%ROWTYPE;
    v_role public.user_role;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_admin_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
    END IF;

    SELECT * INTO v FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    IF v.status = 'rejected' THEN
        RETURN;
    END IF;

    IF v.status <> 'requested' THEN
        RAISE EXCEPTION 'PAYOUT_NOT_REJECTABLE' USING ERRCODE='P0001';
    END IF;

    PERFORM public.apply_wallet_ledger_internal(
        v.mitra_id,
        'mitra_available',
        v.amount_rupiah + v.fee_rupiah,
        'rupiah',
        'payout_rejected_refund',
        'payout',
        v.id
    );

    UPDATE public.payout_requests
    SET status = 'rejected',
        decided_at = pg_catalog.now(),
        decided_by = p_admin_id
    WHERE id = v.id;
END;
$$;

-- 16. RPC PAYOUT: payout_mark_paid
CREATE OR REPLACE FUNCTION public.payout_mark_paid(
    p_payout_id UUID,
    p_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v public.payout_requests%ROWTYPE;
    v_role public.user_role;
BEGIN
    v_role := NULL;
    SELECT u.role INTO v_role
    FROM public.users AS u
    WHERE u.id = p_admin_id AND u.status = 'active'::public.account_status
    FOR SHARE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    IF v_role <> 'admin' THEN
        RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
    END IF;

    SELECT * INTO v FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002';
    END IF;

    IF v.status = 'paid' THEN
        RETURN;
    END IF;

    IF v.status <> 'requested' THEN
        RAISE EXCEPTION 'PAYOUT_NOT_PAYABLE' USING ERRCODE='P0001';
    END IF;

    UPDATE public.payout_requests
    SET status = 'paid',
        decided_at = pg_catalog.now(),
        decided_by = p_admin_id
    WHERE id = v.id;

    -- Tanda ledger payout_disbursement adalah POSITIVE (+amount) menandakan total uang keluar ke rekening mitra
    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
    VALUES
        (NULL, 'platform_revenue', v.fee_rupiah, 'rupiah', 'payout_fee', 'payout', v.id),
        (NULL, 'payout_disbursement', v.amount_rupiah, 'rupiah', 'payout_paid', 'payout', v.id);
END;
$$;

-- 17. RPC HOLDING RELEASE: release_holding
CREATE OR REPLACE FUNCTION public.release_holding(
    p_batch_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v RECORD;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    IF p_batch_limit < 1 OR p_batch_limit > 1000 THEN
        RAISE EXCEPTION 'INVALID_BATCH_LIMIT' USING ERRCODE='22023';
    END IF;

    FOR v IN
        SELECT e.id, e.mitra_id, e.amount_rupiah
        FROM public.mitra_earnings e
        WHERE e.available_at <= pg_catalog.now() AND e.released_at IS NULL
        ORDER BY e.mitra_id, e.id
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_limit
    LOOP
        SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v.mitra_id FOR UPDATE;
        IF NOT FOUND OR v_wallet.pending_rupiah < v.amount_rupiah THEN
            RAISE EXCEPTION 'EARNING_PENDING_BALANCE_MISMATCH' USING ERRCODE='23514';
        END IF;

        UPDATE public.wallets
        SET pending_rupiah = pending_rupiah - v.amount_rupiah,
            available_rupiah = available_rupiah + v.amount_rupiah,
            updated_at = pg_catalog.now()
        WHERE user_id = v.mitra_id;

        INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
        VALUES
            (v.mitra_id, 'mitra_pending', -v.amount_rupiah, 'rupiah', 'holding_release_pending', 'earning', v.id),
            (v.mitra_id, 'mitra_available', v.amount_rupiah, 'rupiah', 'holding_release_available', 'earning', v.id);

        UPDATE public.mitra_earnings
        SET released_at = pg_catalog.now()
        WHERE id = v.id AND released_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'EARNING_ALREADY_RELEASED' USING ERRCODE='23505';
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 18. RPC EXECUTION GRANTS: HANYA SERVICE_ROLE
REVOKE ALL ON FUNCTION public.topup_order_create(TEXT, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_order_create(TEXT, UUID, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.topup_settle(TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_settle(TEXT, TEXT, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.topup_fail(TEXT, public.payment_status, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_fail(TEXT, public.payment_status, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.tip_create(UUID, UUID, UUID, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tip_create(UUID, UUID, UUID, BIGINT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.payout_request(UUID, UUID, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_request(UUID, UUID, BIGINT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.payout_reject(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_reject(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.payout_mark_paid(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_mark_paid(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.release_holding(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_holding(INTEGER) TO service_role;

COMMIT;
