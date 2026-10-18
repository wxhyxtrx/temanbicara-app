-- ========================================================
-- TEMAN BICARA: SIKLUS SESI, EKSTENSI, SETTLEMENT, & CRON TICK (FASE 3 - TASK B6b)
-- Migration: 20261017000015_session_lifecycle.sql
-- ========================================================

-- 1. INTERNAL HELPER: booking_settle_internal
-- Menyelesaikan aspek finansial & penalti saat sesi berakhir:
-- - outcome 'completed' / 'no_show': bagi hasil tarif sesi (source 'session') +
--   bagi hasil ekstensi jika approved (source 'extension', source_id = booking_id).
--   Uang mitra masuk ke mitra_earnings dengan status holding (holding.hours).
-- - outcome 'auto_cancelled_late': refund 100% koin ke pasien via apply_wallet_ledger_internal +
--   strike penalti noshow ke psikolog via apply_strike_suspension.
-- Idempoten: pengecekan catatan unik pada mitra_earnings dan ledger_entries
-- mencegah duplikasi pembagian hasil atau pengembalian saldo jika dipanggil berulang kali.
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

COMMENT ON FUNCTION public.booking_settle_internal(UUID, TEXT) IS 'Internal settlement untuk pembagian hasil mitra/platform atau refund & strike saat sesi berakhir';

-- 2. RPC EXTENSION REQUEST
-- Pasien mengajukan perpanjangan sesi 10 menit.
-- Syarat: status in_progress, psikolog tidak terlambat (psikolog_late=false),
-- belum pernah mengajukan ekstensi (extension_status IS NULL), psikolog menawarkan tarif ekstensi,
-- dan waktu saat ini belum melewati 45 menit dari start_at.
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

COMMENT ON FUNCTION public.extension_request(UUID, UUID) IS 'RPC untuk pasien mengajukan perpanjangan sesi 10 menit';

-- 3. RPC EXTENSION RESPOND
-- Psikolog merespons pengajuan ekstensi (approve atau decline).
-- Hasil:
-- - 'declined': jika psikolog menolak. extension_status -> 'declined'.
-- - 'insufficient_coins': jika disetujui tetapi saldo koin pasien tidak mencukupi (Review Focus #4).
--   Tanpa debit koin, extension_status -> 'declined', transaksi tetap commit.
-- - 'approved': koin dipotong via apply_wallet_ledger_internal, extension_status -> 'approved', extension_coins dicatat.
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

COMMENT ON FUNCTION public.extension_respond(UUID, UUID, BOOLEAN) IS 'RPC untuk psikolog menyetujui atau menolak perpanjangan sesi';

-- 4. RPC SESSION END
-- Psikolog mengakhiri sesi konseling yang sedang berjalan (in_progress -> completed).
-- Memicu settlement honor mitra dan penerimaan platform.
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

COMMENT ON FUNCTION public.session_end(UUID, UUID) IS 'RPC untuk psikolog mengakhiri sesi konseling yang sedang berlangsung';

-- 5. FUNCTION SESSION TICK
-- Menjalankan evaluasi timer dan lifecycle sesi secara berkala:
-- 1. booked & tanpa pesan psikolog > start_at + psikolog_late -> auto_cancelled_late + settle
-- 2. in_progress & pesan psikolog ada tapi pasien belum menyapa > psikolog_first_msg_at + patient_noshow -> no_show + settle
-- 3. in_progress & now() >= start_at + 58 menit -> completed (hard cap) + settle
-- 4. awaiting_patient_choice & now() > choice_deadline_at -> cancelled_by_psikolog + refund 100%
-- Menggunakan FOR UPDATE SKIP LOCKED untuk konkurensi aman multi-worker.
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

COMMENT ON FUNCTION public.session_tick() IS 'Timer periodic pemrosesan transisi siklus sesi konseling dan settlement otomatis';

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
