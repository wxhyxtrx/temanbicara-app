-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000013 (PSIKOLOG CANCEL, STRIKE, & REFUND)
-- Path: supabase/tests/psikolog_cancel_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 1 pasien di auth.users & public.users & profiles
-- 2. DDL Salinan persis dari 20261017000013_psikolog_cancel_strikes.sql
-- 3. Assert booking via booking_create & batal 48 jam -> 0 strike & status awaiting_patient_choice
-- 4. Assert batal 5 jam -> 1 strike (late_cancel)
-- 5. Assert akumulasi 3 poin strike -> suspended_until ~ now() + 7 hari & psikolog_available_slots kosong
-- 6. Assert booking_choose_refund -> saldo pasien kembali penuh 100% & status cancelled_by_psikolog
-- 7. Assert booking_choose_refund dipanggil 2x -> tidak refund ganda (idempoten)
-- 8. Assert reschedule mode B setelah pembatalan psikolog -> status booked & tanpa kenaikan reschedule_count
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b5000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5_pasien@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b5000000-0000-0000-0000-000000000001', 'b5_psikolog@temanbicara.test', '081299990051', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b5000000-0000-0000-0000-000000000002', 'b5_pasien@temanbicara.test', '081299990052', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL PSIKOLOG
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins, suspended_until
) VALUES (
    'b5000000-0000-0000-0000-000000000001', 'Dr. B5 Psikolog, M.Psi', 'SIPP-B5-001', 'https://storage.test/sipp-b5.pdf',
    ARRAY['Depresi', 'Burnout'], 7, 150000, false, 2, NULL
)
ON CONFLICT (user_id) DO UPDATE SET
    tarif_sesi = EXCLUDED.tarif_sesi,
    booking_paused = false,
    suspended_until = NULL,
    extension_price_coins = 2;

-- Setup Jadwal Penuh Psikolog (Semua Hari, 00:00 - 24:00 WIB)
DELETE FROM public.psikolog_schedules WHERE psikolog_id = 'b5000000-0000-0000-0000-000000000001';
INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
SELECT 'b5000000-0000-0000-0000-000000000001', d, 0, 24
FROM pg_catalog.generate_series(0, 6) AS d;

-- 4. SETUP PROFIL PASIEN
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b5000000-0000-0000-0000-000000000002', 'Pasien Pengujian B5', 'Eko', 'Ibu Eko', '081100000055', false)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    nama_panggilan = EXCLUDED.nama_panggilan,
    is_anonim_default = EXCLUDED.is_anonim_default;

-- 5. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('booking', '{"min_hours_before": 1, "max_days_ahead": 14, "max_active_per_patient": 10, "max_per_psikolog_per_day": 10, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb),
    ('strike', '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. SETUP WALLET PASIEN (Saldo awal: 200 koin)
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('b5000000-0000-0000-0000-000000000002', 200, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET
    coin_balance = 200,
    pending_rupiah = 0,
    available_rupiah = 0;

-- ========================================================
-- SALINAN DDL DARI MIGRATION 20261017000013_psikolog_cancel_strikes.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.psikolog_strikes (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
    points SMALLINT NOT NULL CHECK (points > 0),
    reason TEXT NOT NULL CHECK (reason IN ('late_cancel', 'noshow')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_psikolog_strikes_psikolog_id_created_at
    ON public.psikolog_strikes (psikolog_id, created_at DESC);

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

    SELECT COALESCE(pg_catalog.sum(points), 0)::INTEGER
    INTO v_total_points
    FROM public.psikolog_strikes
    WHERE psikolog_id = p_psikolog_id
      AND created_at >= (pg_catalog.now() - (v_window_days * INTERVAL '1 day'));

    IF v_total_points >= v_threshold THEN
        SELECT suspended_until
        INTO v_current_suspended_until
        FROM public.psikolog_profiles
        WHERE user_id = p_psikolog_id
        FOR UPDATE;

        v_new_suspended_until := pg_catalog.now() + (v_suspend_days * INTERVAL '1 day');

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

    v_choice_deadline_at := LEAST(
        pg_catalog.now() + (v_choice_deadline_hours * INTERVAL '1 hour'),
        v_booking.start_at
    );

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
    IF p_booking_id IS NULL OR p_patient_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

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

    IF v_booking.status = 'cancelled_by_psikolog' THEN
        RETURN v_booking;
    END IF;

    IF v_booking.status <> 'awaiting_patient_choice' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

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

-- ========================================================
-- SKENARIO PENGUJIAN OTOMATIS (ASSERTION SUITE)
-- ========================================================

DO $$
DECLARE
    v_psikolog_id CONSTANT UUID := 'b5000000-0000-0000-0000-000000000001';
    v_pasien_id CONSTANT UUID := 'b5000000-0000-0000-0000-000000000002';

    v_slot_48h TIMESTAMPTZ;
    v_slot_5h TIMESTAMPTZ;
    v_slot_6h TIMESTAMPTZ;
    v_slot_7h TIMESTAMPTZ;
    v_slot_reschedule TIMESTAMPTZ;

    v_booking1 public.bookings%ROWTYPE;
    v_booking2 public.bookings%ROWTYPE;
    v_booking3 public.bookings%ROWTYPE;
    v_booking4 public.bookings%ROWTYPE;

    v_strike_count INTEGER;
    v_strike_points INTEGER;
    v_strike_reason TEXT;
    v_suspended_until TIMESTAMPTZ;
    v_slots_count INTEGER;

    v_bal_before INTEGER;
    v_bal_after INTEGER;
    v_ledger_count INTEGER;
BEGIN
    -- Hitung slot waktu pengujian yang presisi jam bulat
    v_slot_48h := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '48 hours';
    v_slot_5h  := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '5 hours';
    v_slot_6h  := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '6 hours';
    v_slot_7h  := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '7 hours';
    v_slot_reschedule := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '72 hours';

    -- ----------------------------------------------------
    -- UJI 1: Setup booking via booking_create & Batal 48 Jam Sebelum Sesi
    -- Harap: 0 strike, status awaiting_patient_choice, choice_deadline_at terisi, suspended_until tetap NULL
    -- ----------------------------------------------------
    v_booking1 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien_id,
        v_psikolog_id,
        v_slot_48h,
        'Keluhan pasien untuk pengujian pembatalan empat puluh delapan jam.'
    );

    IF v_booking1.status <> 'booked' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Booking baru harus berstatus booked, didapat %', v_booking1.status;
    END IF;

    -- Psikolog membatalkan booking (jarak 48 jam > psikolog_cancel_free_hours 24 jam)
    v_booking1 := public.booking_cancel_by_psikolog(v_booking1.id, v_psikolog_id);

    IF v_booking1.status <> 'awaiting_patient_choice' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Status setelah pembatalan psikolog harus awaiting_patient_choice, didapat %', v_booking1.status;
    END IF;

    IF v_booking1.choice_deadline_at IS NULL OR v_booking1.choice_deadline_at > v_booking1.start_at THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: choice_deadline_at harus <= start_at, didapat %', v_booking1.choice_deadline_at;
    END IF;

    SELECT pg_catalog.count(*) INTO v_strike_count
    FROM public.psikolog_strikes
    WHERE booking_id = v_booking1.id;

    IF v_strike_count <> 0 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Pembatalan 48 jam sebelum sesi harus 0 strike, didapat %', v_strike_count;
    END IF;

    SELECT suspended_until INTO v_suspended_until
    FROM public.psikolog_profiles
    WHERE user_id = v_psikolog_id;

    IF v_suspended_until IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: suspended_until harusnya tetap NULL, didapat %', v_suspended_until;
    END IF;

    -- ----------------------------------------------------
    -- UJI 2: Batal 5 Jam Sebelum Sesi -> Tepat 1 Strike (late_cancel)
    -- Harap: 1 strike tercatat, status awaiting_patient_choice, suspended_until tetap NULL (1 < threshold 3)
    -- ----------------------------------------------------
    v_booking2 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien_id,
        v_psikolog_id,
        v_slot_5h,
        'Keluhan pasien untuk pengujian pembatalan terlambat lima jam lagi.'
    );

    v_booking2 := public.booking_cancel_by_psikolog(v_booking2.id, v_psikolog_id);

    IF v_booking2.status <> 'awaiting_patient_choice' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Status setelah pembatalan harus awaiting_patient_choice, didapat %', v_booking2.status;
    END IF;

    SELECT points, reason INTO v_strike_points, v_strike_reason
    FROM public.psikolog_strikes
    WHERE booking_id = v_booking2.id;

    IF v_strike_points <> 1 OR v_strike_reason <> 'late_cancel' THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Strike harus 1 poin late_cancel, didapat points=%, reason=%', v_strike_points, v_strike_reason;
    END IF;

    SELECT suspended_until INTO v_suspended_until
    FROM public.psikolog_profiles
    WHERE user_id = v_psikolog_id;

    IF v_suspended_until IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: 1 strike belum boleh memicu suspensi, didapat %', v_suspended_until;
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: Akumulasi 3 Poin Strike -> suspended_until ~ now()+7 hari & psikolog_available_slots kosong
    -- ----------------------------------------------------
    v_booking3 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien_id,
        v_psikolog_id,
        v_slot_6h,
        'Keluhan pasien untuk akumulasi strike kedua dalam batas waktu toleransi.'
    );
    v_booking3 := public.booking_cancel_by_psikolog(v_booking3.id, v_psikolog_id);

    -- Saat ini total 2 poin strike. Buat booking ke-4 untuk mencapai 3 poin
    v_booking4 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien_id,
        v_psikolog_id,
        v_slot_7h,
        'Keluhan pasien untuk akumulasi strike ketiga pemicu suspensi akun.'
    );
    v_booking4 := public.booking_cancel_by_psikolog(v_booking4.id, v_psikolog_id);

    -- Verifikasi total poin strike psikolog dalam 30 hari = 3
    SELECT pg_catalog.sum(points) INTO v_strike_points
    FROM public.psikolog_strikes
    WHERE psikolog_id = v_psikolog_id;

    IF v_strike_points <> 3 THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Total strike harus 3 poin, didapat %', v_strike_points;
    END IF;

    -- Verifikasi suspended_until terset ke sekitar now() + 7 hari
    SELECT suspended_until INTO v_suspended_until
    FROM public.psikolog_profiles
    WHERE user_id = v_psikolog_id;

    IF v_suspended_until IS NULL OR
       v_suspended_until < (pg_catalog.now() + INTERVAL '6 days 23 hours') OR
       v_suspended_until > (pg_catalog.now() + INTERVAL '7 days 1 hour') THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: suspended_until harusnya now()+7 hari, didapat %', v_suspended_until;
    END IF;

    -- Verifikasi psikolog_available_slots mengembalikan 0 baris (kosong) saat psikolog suspended
    SELECT pg_catalog.count(*) INTO v_slots_count
    FROM public.psikolog_available_slots(v_psikolog_id, pg_catalog.now(), pg_catalog.now() + INTERVAL '7 days');

    IF v_slots_count <> 0 THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: psikolog_available_slots harus kosong saat suspended_until aktif, didapat % baris', v_slots_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: booking_choose_refund -> Saldo Pasien Kembali Penuh 100%
    -- Uji refund pada v_booking2 (tarif 15 koin)
    -- ----------------------------------------------------
    SELECT coin_balance INTO v_bal_before FROM public.wallets WHERE user_id = v_pasien_id;

    v_booking2 := public.booking_choose_refund(v_booking2.id, v_pasien_id);

    IF v_booking2.status <> 'cancelled_by_psikolog' THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Status setelah choose_refund harus cancelled_by_psikolog, didapat %', v_booking2.status;
    END IF;

    IF v_booking2.refund_coins <> 15 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: refund_coins harus 15 koin (100%%), didapat %', v_booking2.refund_coins;
    END IF;

    SELECT coin_balance INTO v_bal_after FROM public.wallets WHERE user_id = v_pasien_id;

    IF v_bal_after - v_bal_before <> 15 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Saldo dompet pasien harus bertambah 15 koin, sebelum: %, sesudah: %', v_bal_before, v_bal_after;
    END IF;

    SELECT pg_catalog.count(*) INTO v_ledger_count
    FROM public.ledger_entries
    WHERE ref_type = 'booking' AND ref_id = v_booking2.id AND reason = 'booking_refund';

    IF v_ledger_count <> 1 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Entri ledger booking_refund harus tercatat 1 kali, didapat %', v_ledger_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: booking_choose_refund Dipanggil 2x -> Idempoten (Tidak Refund Ganda)
    -- ----------------------------------------------------
    v_booking2 := public.booking_choose_refund(v_booking2.id, v_pasien_id);

    SELECT coin_balance INTO v_bal_after FROM public.wallets WHERE user_id = v_pasien_id;
    IF v_bal_after - v_bal_before <> 15 THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Pemanggilan kedua choose_refund menduplikasi refund saldo! Sesudah: %', v_bal_after;
    END IF;

    SELECT pg_catalog.count(*) INTO v_ledger_count
    FROM public.ledger_entries
    WHERE ref_type = 'booking' AND ref_id = v_booking2.id AND reason = 'booking_refund';

    IF v_ledger_count <> 1 THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Entri ledger booking_refund menduplikasi transaksi, didapat %', v_ledger_count;
    END IF;

    -- ----------------------------------------------------
    -- UJI 6: Pindah Slot Pasien Setelah Psikolog Batal (booking_reschedule Mode B)
    -- Booking 1 (v_booking1) masih berstatus awaiting_patient_choice
    -- Untuk menguji reschedule ke slot baru, sementara lepaskan suspensi psikolog
    -- ----------------------------------------------------
    UPDATE public.psikolog_profiles
    SET suspended_until = NULL
    WHERE user_id = v_psikolog_id;

    v_booking1 := public.booking_reschedule(v_booking1.id, v_pasien_id, v_slot_reschedule);

    IF v_booking1.status <> 'booked' THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Reschedule mode B harus mengembalikan status booked, didapat %', v_booking1.status;
    END IF;

    IF v_booking1.start_at <> v_slot_reschedule THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: start_at tidak terupdate ke slot baru, didapat %', v_booking1.start_at;
    END IF;

    IF v_booking1.reschedule_count <> 0 THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: Reschedule mode B tidak boleh menambah reschedule_count, didapat %', v_booking1.reschedule_count;
    END IF;

    IF v_booking1.choice_deadline_at IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: choice_deadline_at harus direset ke NULL setelah reschedule, didapat %', v_booking1.choice_deadline_at;
    END IF;

    RAISE NOTICE 'SEMUA UJI DRY-RUN TASK B5 BERHASIL DIVERIFIKASI DENGAN LENGKAP!';
END;
$$;

ROLLBACK;
