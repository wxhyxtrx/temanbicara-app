-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000015 (SESSION LIFECYCLE & CRON TICK)
-- Path: supabase/tests/session_lifecycle_dryrun.sql
-- Scope:
-- 1. Setup user test: 1 psikolog, 6 pasien di auth.users & public.users & profiles
-- 2. DDL Salinan persis dari 20261017000015_session_lifecycle.sql
-- 3. Assert sesi selesai normal -> earning mitra floor(price*10000*bps/10000) & platform sisa + ekstensi
-- 4. Assert Review Focus #3: session_tick() dipanggil 2x berturut-turut -> baris mitra_earnings & ledger tidak ganda
-- 5. Assert psikolog tidak menyapa (start_at 15 mnt lalu) -> auto_cancelled_late, refund 100%, strike 2 (noshow)
-- 6. Assert pasien no-show -> no_show, refund 0%, earning terbentuk, tanpa strike psikolog
-- 7. Assert Review Focus #4: ekstensi approve dengan saldo kurang -> hasil 'insufficient_coins', saldo tetap, extension_status='declined'
-- 8. Assert psikolog telat (psikolog_late=true) -> extension_request ditolak (PSIKOLOG_LATE)
-- 9. Assert hard cap 58 menit di session_tick() -> status completed & settle
-- 10. Assert awaiting_patient_choice lewat deadline -> cancelled_by_psikolog & refund 100%
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. SETUP USER TEST: auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
    ('b6b00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_psikolog@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien1@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien2@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien3@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien4@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien5@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('b6b00000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6b_pasien6@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. SETUP USER TEST: public.users
INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('b6b00000-0000-0000-0000-000000000001', 'b6b_psikolog@temanbicara.test', '081299990601', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000002', 'b6b_pasien1@temanbicara.test', '081299990602', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000003', 'b6b_pasien2@temanbicara.test', '081299990603', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000004', 'b6b_pasien3@temanbicara.test', '081299990604', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000005', 'b6b_pasien4@temanbicara.test', '081299990605', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000006', 'b6b_pasien5@temanbicara.test', '081299990606', 'pasien'::public.user_role, 'active'::public.account_status),
    ('b6b00000-0000-0000-0000-000000000007', 'b6b_pasien6@temanbicara.test', '081299990607', 'pasien'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- 3. SETUP PROFIL PSIKOLOG
INSERT INTO public.psikolog_profiles (
    user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
    spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins, suspended_until
) VALUES (
    'b6b00000-0000-0000-0000-000000000001', 'Dr. B6b Psikolog, M.Psi', 'SIPP-B6B-001', 'https://storage.test/sipp-b6b.pdf',
    ARRAY['Kecemasan', 'Trauma'], 8, 150000, false, 2, NULL
)
ON CONFLICT (user_id) DO UPDATE SET
    tarif_sesi = EXCLUDED.tarif_sesi,
    booking_paused = false,
    suspended_until = NULL,
    extension_price_coins = 2;

-- Setup Jadwal Penuh Psikolog (Semua Hari, 00:00 - 24:00 WIB)
DELETE FROM public.psikolog_schedules WHERE psikolog_id = 'b6b00000-0000-0000-0000-000000000001';
INSERT INTO public.psikolog_schedules (psikolog_id, weekday, start_hour, end_hour)
SELECT 'b6b00000-0000-0000-0000-000000000001', d, 0, 24
FROM pg_catalog.generate_series(0, 6) AS d;

-- 4. SETUP PROFIL PASIEN
INSERT INTO public.pasien_profiles (user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default)
VALUES
    ('b6b00000-0000-0000-0000-000000000002', 'Pasien Satu B6b', 'Budi', 'Ibu Budi', '081100000602', false),
    ('b6b00000-0000-0000-0000-000000000003', 'Pasien Dua B6b', 'Dewi', 'Pak Dewi', '081100000603', false),
    ('b6b00000-0000-0000-0000-000000000004', 'Pasien Tiga B6b', 'Citra', 'Ibu Citra', '081100000604', false),
    ('b6b00000-0000-0000-0000-000000000005', 'Pasien Empat B6b', 'Doni', 'Pak Doni', '081100000605', false),
    ('b6b00000-0000-0000-0000-000000000006', 'Pasien Lima B6b', 'Eka', 'Ibu Eka', '081100000606', false),
    ('b6b00000-0000-0000-0000-000000000007', 'Pasien Enam B6b', 'Fani', 'Pak Fani', '081100000607', false)
ON CONFLICT (user_id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    nama_panggilan = EXCLUDED.nama_panggilan,
    is_anonim_default = EXCLUDED.is_anonim_default;

-- 5. SETUP SYSTEM SETTINGS
INSERT INTO public.system_settings (key, value)
VALUES
    ('booking', '{"min_hours_before": 1, "max_days_ahead": 14, "max_active_per_patient": 10, "max_per_psikolog_per_day": 10, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8500}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('strike', '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb),
    ('psikolog_late', '{"minutes": 10}'::jsonb),
    ('patient_noshow', '{"minutes": 30}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. SETUP WALLETS PASIEN & MITRA
-- Pasien 1: 50 koin
-- Pasien 2: 20 koin
-- Pasien 3: 20 koin
-- Pasien 4: 15 koin (pas untuk booking sesi 15 koin, sisa 0 saat ekstensi diuji)
-- Pasien 5: 20 koin
-- Pasien 6: 20 koin
-- Psikolog: 0 saldo
INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
VALUES
    ('b6b00000-0000-0000-0000-000000000001', 0, 0, 0),
    ('b6b00000-0000-0000-0000-000000000002', 50, 0, 0),
    ('b6b00000-0000-0000-0000-000000000003', 20, 0, 0),
    ('b6b00000-0000-0000-0000-000000000004', 20, 0, 0),
    ('b6b00000-0000-0000-0000-000000000005', 15, 0, 0),
    ('b6b00000-0000-0000-0000-000000000006', 20, 0, 0),
    ('b6b00000-0000-0000-0000-000000000007', 20, 0, 0)
ON CONFLICT (user_id) DO UPDATE SET
    coin_balance = EXCLUDED.coin_balance,
    pending_rupiah = 0,
    available_rupiah = 0;

-- ========================================================
-- SALINAN DDL DARI MIGRATION 20261017000015_session_lifecycle.sql
-- ========================================================

-- 1. INTERNAL HELPER: booking_settle_internal
CREATE OR REPLACE FUNCTION public.booking_settle_internal(
    p_booking_id UUID,
    p_outcome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_bps INTEGER := 8500;
    v_holding INTEGER := 48;
    v_gross BIGINT;
    v_mitra BIGINT;
    v_platform BIGINT;
    v_ext_gross BIGINT;
    v_ext_mitra BIGINT;
    v_ext_platform BIGINT;
    v_per_noshow SMALLINT := 2;
BEGIN
    IF p_booking_id IS NULL OR p_outcome IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
    END IF;

    IF p_outcome NOT IN ('completed', 'no_show', 'auto_cancelled_late') THEN
        RAISE EXCEPTION 'INVALID_OUTCOME' USING ERRCODE = '22023';
    END IF;

    -- Kunci baris booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- Ambil pengaturan revenue_share dan holding dari system_settings
    SELECT COALESCE((value->>'mitra_bps')::INTEGER, 8500)
    INTO v_bps
    FROM public.system_settings
    WHERE key = 'revenue_share';
    v_bps := COALESCE(v_booking.mitra_share_bps, v_bps, 8500);

    SELECT COALESCE((value->>'hours')::INTEGER, 48)
    INTO v_holding
    FROM public.system_settings
    WHERE key = 'holding';
    v_holding := COALESCE(v_holding, 48);

    IF p_outcome IN ('completed', 'no_show') THEN
        IF v_booking.status NOT IN ('in_progress', 'completed', 'no_show') THEN
            RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
        END IF;

        -- 1. Update status booking & ended_at jika belum
        UPDATE public.bookings
        SET status = p_outcome,
            ended_at = COALESCE(ended_at, pg_catalog.now()),
            updated_at = pg_catalog.now()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

        -- 2. Settle sesi utama (idempoten: cek mitra_earnings source_type='session')
        IF NOT EXISTS (
            SELECT 1 FROM public.mitra_earnings
            WHERE source_type = 'session' AND source_id = p_booking_id
        ) THEN
            v_gross := v_booking.price_coins * 10000;
            v_mitra := pg_catalog.floor((v_gross::NUMERIC * v_bps) / 10000.0)::BIGINT;
            v_platform := v_gross - v_mitra;

            IF v_mitra + v_platform <> v_gross THEN
                RAISE EXCEPTION 'SETTLE_SHARE_CONSERVATION_FAILED' USING ERRCODE = '23514';
            END IF;

            -- Inisialisasi & kunci wallet mitra
            INSERT INTO public.wallets(user_id) VALUES(v_booking.psikolog_id) ON CONFLICT(user_id) DO NOTHING;
            PERFORM 1 FROM public.wallets WHERE user_id = v_booking.psikolog_id FOR UPDATE;

            IF v_mitra > 0 THEN
                UPDATE public.wallets
                SET pending_rupiah = pending_rupiah + v_mitra,
                    updated_at = pg_catalog.now()
                WHERE user_id = v_booking.psikolog_id;

                INSERT INTO public.mitra_earnings(mitra_id, amount_rupiah, source_type, source_id, available_at)
                VALUES(v_booking.psikolog_id, v_mitra, 'session', p_booking_id, pg_catalog.now() + (v_holding * INTERVAL '1 hour'));

                INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
                VALUES (v_booking.psikolog_id, 'mitra_pending', v_mitra, 'rupiah', 'session_pending', 'booking', p_booking_id);
            END IF;

            IF v_platform > 0 THEN
                INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
                VALUES (NULL, 'platform_revenue', v_platform, 'rupiah', 'session_platform', 'booking', p_booking_id);
            END IF;
        END IF;

        -- 3. Settle ekstensi jika approved & extension_coins > 0 (idempoten: cek mitra_earnings source_type='extension')
        IF v_booking.extension_status = 'approved' AND COALESCE(v_booking.extension_coins, 0) > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.mitra_earnings
                WHERE source_type = 'extension' AND source_id = p_booking_id
            ) THEN
                v_ext_gross := v_booking.extension_coins * 10000;
                v_ext_mitra := pg_catalog.floor((v_ext_gross::NUMERIC * v_bps) / 10000.0)::BIGINT;
                v_ext_platform := v_ext_gross - v_ext_mitra;

                IF v_ext_mitra + v_ext_platform <> v_ext_gross THEN
                    RAISE EXCEPTION 'EXTENSION_SHARE_CONSERVATION_FAILED' USING ERRCODE = '23514';
                END IF;

                INSERT INTO public.wallets(user_id) VALUES(v_booking.psikolog_id) ON CONFLICT(user_id) DO NOTHING;
                PERFORM 1 FROM public.wallets WHERE user_id = v_booking.psikolog_id FOR UPDATE;

                IF v_ext_mitra > 0 THEN
                    UPDATE public.wallets
                    SET pending_rupiah = pending_rupiah + v_ext_mitra,
                        updated_at = pg_catalog.now()
                    WHERE user_id = v_booking.psikolog_id;

                    INSERT INTO public.mitra_earnings(mitra_id, amount_rupiah, source_type, source_id, available_at)
                    VALUES(v_booking.psikolog_id, v_ext_mitra, 'extension', p_booking_id, pg_catalog.now() + (v_holding * INTERVAL '1 hour'));

                    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
                    VALUES (v_booking.psikolog_id, 'mitra_pending', v_ext_mitra, 'rupiah', 'extension_pending', 'booking', p_booking_id);
                END IF;

                IF v_ext_platform > 0 THEN
                    INSERT INTO public.ledger_entries(user_id, account, amount, unit, reason, ref_type, ref_id)
                    VALUES (NULL, 'platform_revenue', v_ext_platform, 'rupiah', 'extension_platform', 'booking', p_booking_id);
                END IF;
            END IF;
        END IF;

    ELSIF p_outcome = 'auto_cancelled_late' THEN
        IF v_booking.status NOT IN ('booked', 'auto_cancelled_late') THEN
            RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
        END IF;

        -- 1. Update status booking & cancelled_at & refund_coins
        UPDATE public.bookings
        SET status = 'auto_cancelled_late',
            cancelled_at = COALESCE(cancelled_at, pg_catalog.now()),
            refund_coins = price_coins,
            updated_at = pg_catalog.now()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;

        -- 2. Refund 100% koin ke saldo pasien via apply_wallet_ledger_internal (idempoten)
        IF v_booking.price_coins > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.ledger_entries
                WHERE reason = 'booking_refund'
                  AND ref_type = 'booking'
                  AND ref_id = p_booking_id
                  AND account = 'patient_coins'
            ) THEN
                PERFORM public.apply_wallet_ledger_internal(
                    v_booking.patient_id,
                    'patient_coins',
                    v_booking.price_coins,
                    'coin',
                    'booking_refund',
                    'booking',
                    p_booking_id
                );
            END IF;
        END IF;

        -- 3. Strike penalti noshow ke psikolog (idempoten via ON CONFLICT)
        SELECT COALESCE((value->>'per_noshow')::SMALLINT, 2::SMALLINT)
        INTO v_per_noshow
        FROM public.system_settings
        WHERE key = 'strike';
        v_per_noshow := COALESCE(v_per_noshow, 2::SMALLINT);

        INSERT INTO public.psikolog_strikes (psikolog_id, booking_id, points, reason)
        VALUES (v_booking.psikolog_id, p_booking_id, v_per_noshow, 'noshow')
        ON CONFLICT (booking_id) DO NOTHING;

        PERFORM public.apply_strike_suspension(v_booking.psikolog_id);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_settle_internal(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_settle_internal(UUID, TEXT) TO service_role;

-- 2. RPC EXTENSION REQUEST
CREATE OR REPLACE FUNCTION public.extension_request(
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

    IF v_booking.status <> 'in_progress' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.psikolog_late THEN
        RAISE EXCEPTION 'PSIKOLOG_LATE' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.extension_status IS NOT NULL THEN
        RAISE EXCEPTION 'EXTENSION_ALREADY_REQUESTED' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.extension_price_coins IS NULL OR v_booking.extension_price_coins <= 0 THEN
        RAISE EXCEPTION 'EXTENSION_NOT_OFFERED' USING ERRCODE = 'P0001';
    END IF;

    IF pg_catalog.now() >= v_booking.start_at + INTERVAL '45 minutes' THEN
        RAISE EXCEPTION 'EXTENSION_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.bookings
    SET extension_status = 'requested',
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.extension_request(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extension_request(UUID, UUID) TO service_role;

-- 3. RPC EXTENSION RESPOND
CREATE OR REPLACE FUNCTION public.extension_respond(
    p_booking_id UUID,
    p_psikolog_id UUID,
    p_approve BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_ext_coins INTEGER;
    v_patient_coins BIGINT;
BEGIN
    IF p_booking_id IS NULL OR p_psikolog_id IS NULL OR p_approve IS NULL THEN
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

    IF v_booking.status <> 'in_progress' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.extension_status <> 'requested' THEN
        RAISE EXCEPTION 'NO_PENDING_EXTENSION' USING ERRCODE = 'P0001';
    END IF;

    IF NOT p_approve THEN
        UPDATE public.bookings
        SET extension_status = 'declined',
            updated_at = pg_catalog.now()
        WHERE id = p_booking_id;
        RETURN 'declined';
    END IF;

    -- p_approve = true:
    v_ext_coins := v_booking.extension_price_coins;
    IF v_ext_coins IS NULL OR v_ext_coins <= 0 THEN
        RAISE EXCEPTION 'INVALID_EXTENSION_PRICE' USING ERRCODE = '22023';
    END IF;

    -- Kunci dan periksa saldo koin pasien
    INSERT INTO public.wallets (user_id)
    VALUES (v_booking.patient_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT coin_balance INTO v_patient_coins
    FROM public.wallets
    WHERE user_id = v_booking.patient_id
    FOR UPDATE;

    IF COALESCE(v_patient_coins, 0) < v_ext_coins THEN
        -- Review Focus #4: Saldo kurang -> hasil 'insufficient_coins', tanpa debit, extension_status='declined'
        UPDATE public.bookings
        SET extension_status = 'declined',
            updated_at = pg_catalog.now()
        WHERE id = p_booking_id;
        RETURN 'insufficient_coins';
    END IF;

    -- Debit koin pasien via apply_wallet_ledger_internal
    PERFORM public.apply_wallet_ledger_internal(
        v_booking.patient_id,
        'patient_coins',
        -v_ext_coins,
        'coin',
        'extension_payment',
        'booking',
        p_booking_id
    );

    UPDATE public.bookings
    SET extension_status = 'approved',
        extension_coins = v_ext_coins,
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id;

    RETURN 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.extension_respond(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extension_respond(UUID, UUID, BOOLEAN) TO service_role;

-- 4. RPC SESSION END
CREATE OR REPLACE FUNCTION public.session_end(
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

    -- Idempoten jika sudah selesai
    IF v_booking.status = 'completed' THEN
        RETURN v_booking;
    END IF;

    IF v_booking.status <> 'in_progress' THEN
        RAISE EXCEPTION 'INVALID_BOOKING_STATUS' USING ERRCODE = 'P0001';
    END IF;

    -- Update status menjadi completed
    UPDATE public.bookings
    SET status = 'completed',
        ended_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Settle hasil sesi
    PERFORM public.booking_settle_internal(p_booking_id, 'completed');

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.session_end(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_end(UUID, UUID) TO service_role;

-- 5. FUNCTION SESSION TICK
CREATE OR REPLACE FUNCTION public.session_tick()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_psikolog_late_minutes INTEGER := 10;
    v_patient_noshow_minutes INTEGER := 30;
    v_booking RECORD;
BEGIN
    SELECT COALESCE((value->>'minutes')::INTEGER, 10)
    INTO v_psikolog_late_minutes
    FROM public.system_settings
    WHERE key = 'psikolog_late';
    v_psikolog_late_minutes := COALESCE(v_psikolog_late_minutes, 10);

    SELECT COALESCE((value->>'minutes')::INTEGER, 30)
    INTO v_patient_noshow_minutes
    FROM public.system_settings
    WHERE key = 'patient_noshow';
    v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

    -- 1. Psikolog telat / tidak menyapa: booked & tanpa pesan psikolog > start_at + psikolog_late
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'booked'
          AND psikolog_first_msg_at IS NULL
          AND pg_catalog.now() > start_at + (v_psikolog_late_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.booking_settle_internal(v_booking.id, 'auto_cancelled_late');
        v_count := v_count + 1;
    END LOOP;

    -- 2. Pasien no-show: in_progress & psikolog sudah menyapa tapi pasien belum menyapa > psikolog_first_msg_at + patient_noshow
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND psikolog_first_msg_at IS NOT NULL
          AND patient_first_msg_at IS NULL
          AND pg_catalog.now() > psikolog_first_msg_at + (v_patient_noshow_minutes * INTERVAL '1 minute')
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.booking_settle_internal(v_booking.id, 'no_show');
        v_count := v_count + 1;
    END LOOP;

    -- 3. Hard cap 58 menit: in_progress & waktu sudah mencapai start_at + 58 menit
    FOR v_booking IN
        SELECT id
        FROM public.bookings
        WHERE status = 'in_progress'
          AND pg_catalog.now() >= start_at + INTERVAL '58 minutes'
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.booking_settle_internal(v_booking.id, 'completed');
        v_count := v_count + 1;
    END LOOP;

    -- 4. Batas pilihan pasien lewat: awaiting_patient_choice & choice_deadline_at lewat
    FOR v_booking IN
        SELECT id, patient_id
        FROM public.bookings
        WHERE status = 'awaiting_patient_choice'
          AND choice_deadline_at IS NOT NULL
          AND pg_catalog.now() > choice_deadline_at
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.booking_choose_refund(v_booking.id, v_booking.patient_id);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.session_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_tick() TO service_role;

-- 6. PENJADWALAN PG_CRON: SESSION_TICK (TIAP MENIT)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'session-tick') THEN
            PERFORM cron.unschedule('session-tick');
        END IF;

        PERFORM cron.schedule(
            'session-tick',
            '* * * * *',
            'SELECT public.session_tick();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
$$;

-- ========================================================
-- SKENARIO PENGUJIAN OTOMATIS (ASSERTION SUITE)
-- ========================================================

DO $$
DECLARE
    v_psikolog_id CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000001';
    v_pasien1_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000002';
    v_pasien2_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000003';
    v_pasien3_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000004';
    v_pasien4_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000005';
    v_pasien5_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000006';
    v_pasien6_id  CONSTANT UUID := 'b6b00000-0000-0000-0000-000000000007';

    v_slot1 TIMESTAMPTZ;
    v_slot2 TIMESTAMPTZ;
    v_slot3 TIMESTAMPTZ;
    v_slot4 TIMESTAMPTZ;
    v_slot5 TIMESTAMPTZ;
    v_slot6 TIMESTAMPTZ;
    v_slot7 TIMESTAMPTZ;

    v_b1 public.bookings%ROWTYPE;
    v_b2 public.bookings%ROWTYPE;
    v_b3 public.bookings%ROWTYPE;
    v_b4 public.bookings%ROWTYPE;
    v_b5 public.bookings%ROWTYPE;
    v_b6 public.bookings%ROWTYPE;
    v_b7 public.bookings%ROWTYPE;

    v_bal_p1 BIGINT;
    v_bal_p2 BIGINT;
    v_bal_p3 BIGINT;
    v_bal_p4 BIGINT;
    v_bal_p6 BIGINT;
    v_mitra_wallet public.wallets%ROWTYPE;

    v_earning_session_amt BIGINT;
    v_earning_ext_amt BIGINT;
    v_session_pending_amt BIGINT;
    v_session_platform_amt BIGINT;
    v_ext_pending_amt BIGINT;
    v_ext_platform_amt BIGINT;

    v_earnings_cnt_before INTEGER;
    v_ledger_cnt_before INTEGER;
    v_earnings_cnt_after INTEGER;
    v_ledger_cnt_after INTEGER;

    v_respond_res TEXT;
    v_tick_res INTEGER;
    v_strike_pts SMALLINT;
    v_strike_rsn TEXT;
    v_err_caught BOOLEAN := false;
BEGIN
    v_slot1 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '3 hours';
    v_slot2 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '4 hours';
    v_slot3 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '5 hours';
    v_slot4 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '6 hours';
    v_slot5 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '7 hours';
    v_slot6 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '8 hours';
    v_slot7 := pg_catalog.date_trunc('hour', pg_catalog.now()) + INTERVAL '9 hours';

    -- ----------------------------------------------------
    -- UJI 1: Sesi selesai normal via session_end & ekstensi approved (Uang, Holding, Ledger)
    -- Pasien 1 (saldo 50): booking 1 (15 koin -> saldo 35)
    -- Ekstensi disetujui (2 koin -> saldo 33)
    -- Sesi diakhiri -> earning sesi floor(15*10000*8500/10000) = 127.500, platform 22.500
    -- Earning ekstensi floor(2*10000*8500/10000) = 17.000, platform 3.000
    -- Pending rupiah mitra = 127.500 + 17.000 = 144.500
    -- ----------------------------------------------------
    v_b1 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot1,
        'Keluhan uji siklus sesi lengkap pasien satu untuk pengujian settlement normal.'
    );

    IF v_b1.status <> 'booked' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Booking 1 harus berstatus booked, didapat %', v_b1.status;
    END IF;

    -- Simulasikan sesi berjalan (in_progress, waktu mulai 10 mnt lalu, kedua pihak menyapa)
    UPDATE public.bookings
    SET status = 'in_progress',
        start_at = pg_catalog.now() - INTERVAL '10 minutes',
        psikolog_first_msg_at = pg_catalog.now() - INTERVAL '8 minutes',
        patient_first_msg_at = pg_catalog.now() - INTERVAL '7 minutes',
        psikolog_late = false
    WHERE id = v_b1.id
    RETURNING * INTO v_b1;

    -- Pasien 1 mengajukan ekstensi
    v_b1 := public.extension_request(v_b1.id, v_pasien1_id);

    IF v_b1.extension_status <> 'requested' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: extension_status harus requested, didapat %', v_b1.extension_status;
    END IF;

    -- Psikolog menyetujui ekstensi
    v_respond_res := public.extension_respond(v_b1.id, v_psikolog_id, true);

    IF v_respond_res <> 'approved' THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: extension_respond harus approved, didapat %', v_respond_res;
    END IF;

    SELECT coin_balance INTO v_bal_p1 FROM public.wallets WHERE user_id = v_pasien1_id;
    IF v_bal_p1 <> 33 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Saldo koin pasien 1 harus 33 (50 - 15 - 2), didapat %', v_bal_p1;
    END IF;

    SELECT * INTO v_b1 FROM public.bookings WHERE id = v_b1.id;
    IF v_b1.extension_status <> 'approved' OR v_b1.extension_coins <> 2 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Data ekstensi tidak sesuai di booking, extension_status=%, coins=%', v_b1.extension_status, v_b1.extension_coins;
    END IF;

    -- Psikolog mengakhiri sesi
    v_b1 := public.session_end(v_b1.id, v_psikolog_id);

    IF v_b1.status <> 'completed' OR v_b1.ended_at IS NULL THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Status booking 1 harus completed dan ended_at terisi, status=%', v_b1.status;
    END IF;

    -- Verifikasi mitra_earnings (holding)
    SELECT amount_rupiah INTO v_earning_session_amt
    FROM public.mitra_earnings
    WHERE source_type = 'session' AND source_id = v_b1.id;

    IF v_earning_session_amt <> 127500 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Earning sesi mitra harus 127.500, didapat %', v_earning_session_amt;
    END IF;

    SELECT amount_rupiah INTO v_earning_ext_amt
    FROM public.mitra_earnings
    WHERE source_type = 'extension' AND source_id = v_b1.id;

    IF v_earning_ext_amt <> 17000 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Earning ekstensi mitra harus 17.000, didapat %', v_earning_ext_amt;
    END IF;

    -- Verifikasi ledger_entries
    SELECT amount INTO v_session_pending_amt
    FROM public.ledger_entries
    WHERE reason = 'session_pending' AND ref_type = 'booking' AND ref_id = v_b1.id AND account = 'mitra_pending';

    SELECT amount INTO v_session_platform_amt
    FROM public.ledger_entries
    WHERE reason = 'session_platform' AND ref_type = 'booking' AND ref_id = v_b1.id AND account = 'platform_revenue';

    IF v_session_pending_amt <> 127500 OR v_session_platform_amt <> 22500 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Ledger sesi tidak seimbang: pending=%, platform=%', v_session_pending_amt, v_session_platform_amt;
    END IF;

    SELECT amount INTO v_ext_pending_amt
    FROM public.ledger_entries
    WHERE reason = 'extension_pending' AND ref_type = 'booking' AND ref_id = v_b1.id AND account = 'mitra_pending';

    SELECT amount INTO v_ext_platform_amt
    FROM public.ledger_entries
    WHERE reason = 'extension_platform' AND ref_type = 'booking' AND ref_id = v_b1.id AND account = 'platform_revenue';

    IF v_ext_pending_amt <> 17000 OR v_ext_platform_amt <> 3000 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Ledger ekstensi tidak seimbang: pending=%, platform=%', v_ext_pending_amt, v_ext_platform_amt;
    END IF;

    SELECT * INTO v_mitra_wallet FROM public.wallets WHERE user_id = v_psikolog_id;
    IF v_mitra_wallet.pending_rupiah <> 144500 THEN
        RAISE EXCEPTION 'UJI 1 GAGAL: Wallet mitra pending_rupiah harus 144.500 (127.500 + 17.000), didapat %', v_mitra_wallet.pending_rupiah;
    END IF;

    -- ----------------------------------------------------
    -- UJI 2: Review Focus #3 - Idempotensi session_tick() (dipanggil 2x berturut-turut)
    -- Jumlah baris mitra_earnings & ledger untuk booking 1 tidak boleh bertambah
    -- ----------------------------------------------------
    SELECT pg_catalog.count(*) INTO v_earnings_cnt_before
    FROM public.mitra_earnings
    WHERE source_id = v_b1.id;

    SELECT pg_catalog.count(*) INTO v_ledger_cnt_before
    FROM public.ledger_entries
    WHERE ref_id = v_b1.id;

    -- Panggilan pertama session_tick()
    PERFORM public.session_tick();

    -- Panggilan kedua session_tick()
    PERFORM public.session_tick();

    SELECT pg_catalog.count(*) INTO v_earnings_cnt_after
    FROM public.mitra_earnings
    WHERE source_id = v_b1.id;

    SELECT pg_catalog.count(*) INTO v_ledger_cnt_after
    FROM public.ledger_entries
    WHERE ref_id = v_b1.id;

    IF v_earnings_cnt_after <> v_earnings_cnt_before THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Review Focus #3 - Baris mitra_earnings bertambah setelah tick, before=%, after=%', v_earnings_cnt_before, v_earnings_cnt_after;
    END IF;

    IF v_ledger_cnt_after <> v_ledger_cnt_before THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Review Focus #3 - Baris ledger_entries bertambah setelah tick, before=%, after=%', v_ledger_cnt_before, v_ledger_cnt_after;
    END IF;

    SELECT pending_rupiah INTO v_mitra_wallet.pending_rupiah FROM public.wallets WHERE user_id = v_psikolog_id;
    IF v_mitra_wallet.pending_rupiah <> 144500 THEN
        RAISE EXCEPTION 'UJI 2 GAGAL: Review Focus #3 - Saldo pending_rupiah mitra berubah setelah tick 2x, didapat %', v_mitra_wallet.pending_rupiah;
    END IF;

    -- ----------------------------------------------------
    -- UJI 3: Psikolog tidak menyapa (start_at 15 mnt lalu > psikolog_late 10 mnt)
    -- Harap: auto_cancelled_late, refund 100% (15 koin), strike 2 (noshow)
    -- ----------------------------------------------------
    v_b2 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien2_id,
        v_psikolog_id,
        v_slot2,
        'Keluhan uji psikolog telat tidak menyapa dalam batas toleransi sepuluh menit.'
    );

    SELECT coin_balance INTO v_bal_p2 FROM public.wallets WHERE user_id = v_pasien2_id;
    IF v_bal_p2 <> 5 THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Saldo koin pasien 2 setelah booking harus 5 (20 - 15), didapat %', v_bal_p2;
    END IF;

    -- Set start_at 15 menit yang lalu, tanpa pesan psikolog
    UPDATE public.bookings
    SET start_at = pg_catalog.now() - INTERVAL '15 minutes',
        psikolog_first_msg_at = NULL,
        status = 'booked'
    WHERE id = v_b2.id;

    -- Jalankan session_tick()
    PERFORM public.session_tick();

    SELECT * INTO v_b2 FROM public.bookings WHERE id = v_b2.id;
    IF v_b2.status <> 'auto_cancelled_late' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Booking 2 status harus auto_cancelled_late, didapat %', v_b2.status;
    END IF;

    IF v_b2.refund_coins <> 15 OR v_b2.cancelled_at IS NULL THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Booking 2 refund_coins harus 15 dan cancelled_at terisi, refund=%, cancelled_at=%', v_b2.refund_coins, v_b2.cancelled_at;
    END IF;

    SELECT coin_balance INTO v_bal_p2 FROM public.wallets WHERE user_id = v_pasien2_id;
    IF v_bal_p2 <> 20 THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Saldo koin pasien 2 harus kembali penuh 20 (5 + 15 refund), didapat %', v_bal_p2;
    END IF;

    SELECT points, reason INTO v_strike_pts, v_strike_rsn
    FROM public.psikolog_strikes
    WHERE booking_id = v_b2.id;

    IF v_strike_pts <> 2 OR v_strike_rsn <> 'noshow' THEN
        RAISE EXCEPTION 'UJI 3 GAGAL: Psikolog harus mendapat strike 2 poin noshow, didapat points=%, reason=%', v_strike_pts, v_strike_rsn;
    END IF;

    -- ----------------------------------------------------
    -- UJI 4: Pasien no-show (patient_noshow 30 mnt lewat setelah pesan pertama psikolog)
    -- Harap: no_show, refund 0%, earning mitra terbentuk, tanpa strike psikolog
    -- ----------------------------------------------------
    v_b3 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien3_id,
        v_psikolog_id,
        v_slot3,
        'Keluhan uji pasien no-show tidak mengirim pesan sama sekali sepanjang toleransi tiga puluh menit.'
    );

    UPDATE public.bookings
    SET status = 'in_progress',
        start_at = pg_catalog.now() - INTERVAL '40 minutes',
        psikolog_first_msg_at = pg_catalog.now() - INTERVAL '35 minutes',
        patient_first_msg_at = NULL
    WHERE id = v_b3.id;

    PERFORM public.session_tick();

    SELECT * INTO v_b3 FROM public.bookings WHERE id = v_b3.id;
    IF v_b3.status <> 'no_show' THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Booking 3 status harus no_show, didapat %', v_b3.status;
    END IF;

    IF v_b3.refund_coins <> 0 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: No-show pasien harus refund 0 koin, didapat %', v_b3.refund_coins;
    END IF;

    SELECT coin_balance INTO v_bal_p3 FROM public.wallets WHERE user_id = v_pasien3_id;
    IF v_bal_p3 <> 5 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Saldo koin pasien 3 harus tetap 5 (refund 0), didapat %', v_bal_p3;
    END IF;

    SELECT amount_rupiah INTO v_earning_session_amt
    FROM public.mitra_earnings
    WHERE source_type = 'session' AND source_id = v_b3.id;

    IF v_earning_session_amt <> 127500 THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: Earning mitra harus terbentuk untuk no-show pasien (127.500), didapat %', v_earning_session_amt;
    END IF;

    IF EXISTS (SELECT 1 FROM public.psikolog_strikes WHERE booking_id = v_b3.id) THEN
        RAISE EXCEPTION 'UJI 4 GAGAL: No-show pasien tidak boleh memberi strike ke psikolog';
    END IF;

    -- ----------------------------------------------------
    -- UJI 5: Review Focus #4 - Ekstensi approve dengan saldo koin kurang
    -- Pasien 4 saldo awal 15 koin, booking 15 koin -> sisa saldo 0 koin
    -- Ekstensi disetujui psikolog -> return 'insufficient_coins', status 'declined', saldo tetap 0
    -- ----------------------------------------------------
    v_b4 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien4_id,
        v_psikolog_id,
        v_slot4,
        'Keluhan uji ekstensi dengan saldo kurang untuk memastikan penolakan otomatis tanpa exception.'
    );

    SELECT coin_balance INTO v_bal_p4 FROM public.wallets WHERE user_id = v_pasien4_id;
    IF v_bal_p4 <> 0 THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Review Focus #4 - Saldo koin pasien 4 harus 0 (15 - 15), didapat %', v_bal_p4;
    END IF;

    UPDATE public.bookings
    SET status = 'in_progress',
        start_at = pg_catalog.now() - INTERVAL '10 minutes',
        psikolog_first_msg_at = pg_catalog.now() - INTERVAL '8 minutes',
        patient_first_msg_at = pg_catalog.now() - INTERVAL '7 minutes',
        psikolog_late = false
    WHERE id = v_b4.id
    RETURNING * INTO v_b4;

    -- Pasien 4 ajukan ekstensi
    v_b4 := public.extension_request(v_b4.id, v_pasien4_id);

    IF v_b4.extension_status <> 'requested' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: extension_status harus requested, didapat %', v_b4.extension_status;
    END IF;

    -- Psikolog setujui ekstensi (tetapi saldo koin pasien 0 < tarif ekstensi 2 koin)
    v_respond_res := public.extension_respond(v_b4.id, v_psikolog_id, true);

    IF v_respond_res <> 'insufficient_coins' THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Review Focus #4 - extension_respond harus mengembalikan insufficient_coins, didapat %', v_respond_res;
    END IF;

    SELECT coin_balance INTO v_bal_p4 FROM public.wallets WHERE user_id = v_pasien4_id;
    IF v_bal_p4 <> 0 THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Review Focus #4 - Saldo koin pasien 4 harus tetap 0 (tidak didebit), didapat %', v_bal_p4;
    END IF;

    SELECT * INTO v_b4 FROM public.bookings WHERE id = v_b4.id;
    IF v_b4.extension_status <> 'declined' OR v_b4.extension_coins IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 5 GAGAL: Review Focus #4 - Booking harus extension_status=declined dan extension_coins IS NULL, status=%, coins=%', v_b4.extension_status, v_b4.extension_coins;
    END IF;

    -- ----------------------------------------------------
    -- UJI 6: Psikolog telat (psikolog_late=true) -> extension_request ditolak
    -- ----------------------------------------------------
    v_b5 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien5_id,
        v_psikolog_id,
        v_slot5,
        'Keluhan uji pengajuan ekstensi saat psikolog terlambat hadir.'
    );

    UPDATE public.bookings
    SET status = 'in_progress',
        start_at = pg_catalog.now() - INTERVAL '15 minutes',
        psikolog_first_msg_at = pg_catalog.now() - INTERVAL '13 minutes',
        patient_first_msg_at = pg_catalog.now() - INTERVAL '12 minutes',
        psikolog_late = true
    WHERE id = v_b5.id;

    v_err_caught := false;
    BEGIN
        PERFORM public.extension_request(v_b5.id, v_pasien5_id);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%PSIKOLOG_LATE%' THEN
                v_err_caught := true;
            ELSE
                RAISE;
            END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: extension_request harus melempar PSIKOLOG_LATE jika psikolog terlambat';
    END IF;

    SELECT extension_status INTO v_b5.extension_status FROM public.bookings WHERE id = v_b5.id;
    IF v_b5.extension_status IS NOT NULL THEN
        RAISE EXCEPTION 'UJI 6 GAGAL: extension_status harus tetap NULL jika ditolak';
    END IF;

    -- ----------------------------------------------------
    -- UJI 7: Hard cap 58 menit di session_tick()
    -- Booking in_progress sudah mencapai start_at + 58 menit -> otomatis completed & settle
    -- ----------------------------------------------------
    v_b6 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien1_id,
        v_psikolog_id,
        v_slot6,
        'Keluhan uji batas waktu hard cap lima puluh delapan menit konseling.'
    );

    UPDATE public.bookings
    SET status = 'in_progress',
        start_at = pg_catalog.now() - INTERVAL '59 minutes',
        psikolog_first_msg_at = pg_catalog.now() - INTERVAL '58 minutes',
        patient_first_msg_at = pg_catalog.now() - INTERVAL '57 minutes'
    WHERE id = v_b6.id;

    PERFORM public.session_tick();

    SELECT * INTO v_b6 FROM public.bookings WHERE id = v_b6.id;
    IF v_b6.status <> 'completed' OR v_b6.ended_at IS NULL THEN
        RAISE EXCEPTION 'UJI 7 GAGAL: Booking 6 harus otomatis completed di hard cap 58 menit, status=%', v_b6.status;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.mitra_earnings WHERE source_type = 'session' AND source_id = v_b6.id) THEN
        RAISE EXCEPTION 'UJI 7 GAGAL: Earning sesi mitra harus terbentuk saat hard cap completed tercapai';
    END IF;

    -- ----------------------------------------------------
    -- UJI 8: Batas waktu pilihan pasien lewat (awaiting_patient_choice & choice_deadline_at lewat)
    -- Harap: otomatis cancelled_by_psikolog dan refund 100% (15 koin)
    -- ----------------------------------------------------
    v_b7 := public.booking_create(
        pg_catalog.gen_random_uuid(),
        v_pasien6_id,
        v_psikolog_id,
        v_slot7,
        'Keluhan uji batas waktu pilihan pasien terlampaui setelah psikolog membatalkan janji.'
    );

    -- Simulasikan pembatalan oleh psikolog dengan deadline yang sudah kedaluwarsa
    UPDATE public.bookings
    SET status = 'awaiting_patient_choice',
        choice_deadline_at = pg_catalog.now() - INTERVAL '1 hour'
    WHERE id = v_b7.id;

    SELECT coin_balance INTO v_bal_p6 FROM public.wallets WHERE user_id = v_pasien6_id;
    IF v_bal_p6 <> 5 THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Saldo awal pasien 6 setelah booking harus 5 (20 - 15), didapat %', v_bal_p6;
    END IF;

    PERFORM public.session_tick();

    SELECT * INTO v_b7 FROM public.bookings WHERE id = v_b7.id;
    IF v_b7.status <> 'cancelled_by_psikolog' THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Booking 7 status harus cancelled_by_psikolog, didapat %', v_b7.status;
    END IF;

    SELECT coin_balance INTO v_bal_p6 FROM public.wallets WHERE user_id = v_pasien6_id;
    IF v_bal_p6 <> 20 THEN
        RAISE EXCEPTION 'UJI 8 GAGAL: Saldo koin pasien 6 harus kembali 20 (5 + 15 auto-refund), didapat %', v_bal_p6;
    END IF;

    RAISE NOTICE 'SELURUH UJI SIKLUS SESI & CRON TICK BERHASIL (8 SKENARIO)';
END;
$$;

ROLLBACK;
