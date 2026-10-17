-- ========================================================
-- TEMAN BICARA: PEMBATALAN OLEH PSIKOLOG, PILIHAN PASIEN, & STRIKE (FASE 3 - TASK B5)
-- Migration: 20261017000013_psikolog_cancel_strikes.sql
-- ========================================================

-- 1. TABEL PSIKOLOG STRIKES
CREATE TABLE IF NOT EXISTS public.psikolog_strikes (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
    points SMALLINT NOT NULL CHECK (points > 0),
    reason TEXT NOT NULL CHECK (reason IN ('late_cancel', 'noshow')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.psikolog_strikes IS 'Poin penalti (strike) terhadap psikolog akibat pembatalan terlambat atau no-show';
COMMENT ON COLUMN public.psikolog_strikes.points IS 'Jumlah poin penalti (1 untuk late_cancel, 2 untuk noshow)';
COMMENT ON COLUMN public.psikolog_strikes.reason IS 'Alasan strike: late_cancel atau noshow';

CREATE INDEX IF NOT EXISTS idx_psikolog_strikes_psikolog_id_created_at
    ON public.psikolog_strikes (psikolog_id, created_at DESC);

-- 2. ROW LEVEL SECURITY & PERMISSIONS
ALTER TABLE public.psikolog_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psikolog_strikes_select_policy ON public.psikolog_strikes;
CREATE POLICY psikolog_strikes_select_policy ON public.psikolog_strikes
    FOR SELECT TO authenticated
    USING (
        auth.uid() = psikolog_id OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

REVOKE ALL ON TABLE public.psikolog_strikes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.psikolog_strikes TO authenticated, service_role;
GRANT ALL ON TABLE public.psikolog_strikes TO service_role;

-- 3. INTERNAL HELPER: apply_strike_suspension
-- Menghitung akumulasi strike dalam window_days. Jika mencapai threshold,
-- mengeset suspended_until = now() + suspend_days tanpa memendekkan penalti yang sudah berjalan.
CREATE OR REPLACE FUNCTION public.apply_strike_suspension(
    p_psikolog_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_threshold INTEGER := 3;
    v_window_days INTEGER := 30;
    v_suspend_days INTEGER := 7;
    v_total_points INTEGER := 0;
    v_new_suspended_until TIMESTAMPTZ;
    v_current_suspended_until TIMESTAMPTZ;
BEGIN
    IF p_psikolog_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Ambil pengaturan strike dari system_settings
    SELECT
        COALESCE((value->>'threshold')::INTEGER, 3),
        COALESCE((value->>'window_days')::INTEGER, 30),
        COALESCE((value->>'suspend_days')::INTEGER, 7)
    INTO
        v_threshold,
        v_window_days,
        v_suspend_days
    FROM public.system_settings
    WHERE key = 'strike';

    v_threshold := COALESCE(v_threshold, 3);
    v_window_days := COALESCE(v_window_days, 30);
    v_suspend_days := COALESCE(v_suspend_days, 7);

    -- 2. Hitung total poin strike aktif dalam jendela window_days
    SELECT COALESCE(pg_catalog.sum(points), 0)::INTEGER
    INTO v_total_points
    FROM public.psikolog_strikes
    WHERE psikolog_id = p_psikolog_id
      AND created_at >= (pg_catalog.now() - (v_window_days * INTERVAL '1 day'));

    -- 3. Jika mencapai atau melampaui threshold, terapkan suspensi
    IF v_total_points >= v_threshold THEN
        SELECT suspended_until
        INTO v_current_suspended_until
        FROM public.psikolog_profiles
        WHERE user_id = p_psikolog_id
        FOR UPDATE;

        v_new_suspended_until := pg_catalog.now() + (v_suspend_days * INTERVAL '1 day');

        -- Jangan memendekkan suspended_until yang sudah ada
        IF v_current_suspended_until IS NULL OR v_current_suspended_until < v_new_suspended_until THEN
            UPDATE public.psikolog_profiles
            SET suspended_until = v_new_suspended_until,
                updated_at = pg_catalog.now()
            WHERE user_id = p_psikolog_id;
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_strike_suspension(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_strike_suspension(UUID) TO service_role;

-- 4. RPC BOOKING CANCEL BY PSIKOLOG
CREATE OR REPLACE FUNCTION public.booking_cancel_by_psikolog(
    p_booking_id UUID,
    p_psikolog_id UUID
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_choice_deadline_hours INTEGER := 48;
    v_psikolog_cancel_free_hours INTEGER := 24;
    v_per_late_cancel SMALLINT := 1;
    v_choice_deadline_at TIMESTAMPTZ;
BEGIN
    -- 1. Validasi input & kunci baris booking
    IF p_booking_id IS NULL OR p_psikolog_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.psikolog_id <> p_psikolog_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status <> 'booked' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Ambil parameter dari system_settings
    SELECT
        COALESCE((value->>'choice_deadline_hours')::INTEGER, 48),
        COALESCE((value->>'psikolog_cancel_free_hours')::INTEGER, 24)
    INTO
        v_choice_deadline_hours,
        v_psikolog_cancel_free_hours
    FROM public.system_settings
    WHERE key = 'booking';

    v_choice_deadline_hours := COALESCE(v_choice_deadline_hours, 48);
    v_psikolog_cancel_free_hours := COALESCE(v_psikolog_cancel_free_hours, 24);

    SELECT COALESCE((value->>'per_late_cancel')::SMALLINT, 1::SMALLINT)
    INTO v_per_late_cancel
    FROM public.system_settings
    WHERE key = 'strike';

    v_per_late_cancel := COALESCE(v_per_late_cancel, 1::SMALLINT);

    -- 3. Hitung choice_deadline_at = least(now() + choice_deadline_hours, start_at)
    v_choice_deadline_at := pg_catalog.least(
        pg_catalog.now() + (v_choice_deadline_hours * INTERVAL '1 hour'),
        v_booking.start_at
    );

    -- 4. Periksa penalti strike jika start_at - now() < psikolog_cancel_free_hours
    IF (v_booking.start_at - pg_catalog.now()) < (v_psikolog_cancel_free_hours * INTERVAL '1 hour') THEN
        INSERT INTO public.psikolog_strikes (
            psikolog_id,
            booking_id,
            points,
            reason,
            created_at
        ) VALUES (
            p_psikolog_id,
            p_booking_id,
            v_per_late_cancel,
            'late_cancel',
            pg_catalog.now()
        )
        ON CONFLICT (booking_id) DO NOTHING;

        PERFORM public.apply_strike_suspension(p_psikolog_id);
    END IF;

    -- 5. Ubah status booking menjadi awaiting_patient_choice
    UPDATE public.bookings
    SET status = 'awaiting_patient_choice',
        choice_deadline_at = v_choice_deadline_at,
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_cancel_by_psikolog(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_cancel_by_psikolog(UUID, UUID) TO service_role;

-- 5. RPC BOOKING CHOOSE REFUND
CREATE OR REPLACE FUNCTION public.booking_choose_refund(
    p_booking_id UUID,
    p_patient_id UUID
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
BEGIN
    -- 1. Validasi input
    IF p_booking_id IS NULL OR p_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    -- 2. Kunci baris booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
    END IF;

    -- 3. Idempotensi: jika sudah berstatus cancelled_by_psikolog, kembalikan langsung tanpa refund ganda
    IF v_booking.status = 'cancelled_by_psikolog' THEN
        RETURN v_booking;
    END IF;

    IF v_booking.status <> 'awaiting_patient_choice' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Refund 100% koin ke saldo pasien via apply_wallet_ledger_internal
    IF v_booking.price_coins > 0 THEN
        PERFORM public.apply_wallet_ledger_internal(
            p_patient_id,
            'patient_coins',
            v_booking.price_coins,
            'coin',
            'booking_refund',
            'booking',
            p_booking_id
        );
    END IF;

    -- 5. Update status booking menjadi cancelled_by_psikolog
    UPDATE public.bookings
    SET status = 'cancelled_by_psikolog',
        cancelled_at = pg_catalog.now(),
        refund_coins = v_booking.price_coins,
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_choose_refund(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_choose_refund(UUID, UUID) TO service_role;
