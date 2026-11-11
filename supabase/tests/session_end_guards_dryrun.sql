-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 20261111000028 (SESSION END GUARDS)
-- Path: supabase/tests/session_end_guards_dryrun.sql
-- Scope:
-- 1. Setup fixture dinamis & terisolasi (UUID acak, tanpa CREATE ROLE, tanpa overwrite data dev)
-- 2. DDL Salinan persis dari 20261111000028_session_end_guards.sql
-- 3. Uji 1: Penolakan end sebelum start_at (error SESSION_NOT_STARTED, tanpa settlement)
-- 4. Uji 2: Penolakan end saat pasien belum membalas sebelum batas no-show (error PATIENT_NO_SHOW_PENDING, tanpa settlement)
-- 5. Uji 3: Penolakan end saat psikolog & pasien belum pernah mengirim pesan (error PATIENT_NO_SHOW_PENDING, tanpa settlement)
-- 6. Uji 4: Sesi normal sesudah start_at dengan pesan pasien -> sukses completed & settlement membayar mitra
-- 7. Uji 5: Sesi sesudah start_at & batas no-show pasien terlewati -> sukses completed & settlement membayar mitra
-- 8. Uji 6: Verifikasi fungsi SECURITY DEFINER, search_path kosong, dan hak akses REVOKE/GRANT
-- 9. Penanda DRYRUN_OK dan ROLLBACK
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- AMAN DIJALANKAN DI SUPABASE DEV (TIDAK MERUSAK/MENIMPA DATA EKSIS)
-- ========================================================

BEGIN;

-- ========================================================
-- 1. DDL SALINAN PERSIS DARI 20261111000028_session_end_guards.sql
-- ========================================================

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
    v_patient_noshow_minutes INTEGER := 30;
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

    -- Guard 1: Tolak jika waktu sekarang belum mencapai start_at
    IF pg_catalog.now() < v_booking.start_at THEN
        RAISE EXCEPTION 'SESSION_NOT_STARTED: Sesi belum dimulai.' USING ERRCODE = 'P0001';
    END IF;

    -- Guard 2: Jika pasien belum membalas pesan, tolak hingga batas patient_noshow terlewati
    IF v_booking.patient_first_msg_at IS NULL THEN
        SELECT COALESCE((value->>'minutes')::INTEGER, 30)
        INTO v_patient_noshow_minutes
        FROM public.system_settings
        WHERE key = 'patient_noshow';
        v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

        IF v_booking.psikolog_first_msg_at IS NULL OR
           pg_catalog.now() < v_booking.psikolog_first_msg_at + (v_patient_noshow_minutes * INTERVAL '1 minute') THEN
            RAISE EXCEPTION 'PATIENT_NO_SHOW_PENDING: Pasien belum membalas pesan dan batas waktu no-show belum terlewati.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Update status menjadi completed
    UPDATE public.bookings
    SET status = 'completed',
        ended_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Settle hasil sesi (honor mitra dan revenue platform)
    PERFORM public.booking_settle_internal(p_booking_id, 'completed');

    RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.session_end(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_end(UUID, UUID) TO service_role;

-- ========================================================
-- 2. EKSEKUSI PENGUJIAN DENGAN FIXTURE DINAMIS TERISOLASI
-- Catatan: Tidak menulis ke public.system_settings agar tidak menimpa/menambah
-- konfigurasi DB bersama dan sekaligus menguji pembacaan nilai eksis maupun
-- fallback default fungsi (patient_noshow=30 menit, mitra_share_bps=8500, holding=48 jam).
-- ========================================================

DO $$
DECLARE
    -- UUID acak unik agar tidak bertabrakan dengan data dev eksis
    v_psikolog_id UUID := gen_random_uuid();
    v_pasien_id UUID := gen_random_uuid();
    v_psi_email TEXT := 'guard_psi_' || replace(v_psikolog_id::text, '-', '') || '@temanbicara.test';
    v_pas_email TEXT := 'guard_pas_' || replace(v_pasien_id::text, '-', '') || '@temanbicara.test';
    v_psi_wa TEXT := '08' || substr(replace(replace(v_psikolog_id::text, '-', ''), 'a', '1'), 1, 10);
    v_pas_wa TEXT := '08' || substr(replace(replace(v_pasien_id::text, '-', ''), 'b', '2'), 1, 10);

    v_b1_id UUID := gen_random_uuid();
    v_b2_id UUID := gen_random_uuid();
    v_b3_id UUID := gen_random_uuid();
    v_b4_id UUID := gen_random_uuid();
    v_b5_id UUID := gen_random_uuid();

    v_patient_noshow_minutes INTEGER := 30;
    v_res public.bookings;
    v_err_caught BOOLEAN;
    v_earning_count INTEGER;
    v_pending_balance BIGINT;
BEGIN
    -- Baca konfigurasi patient_noshow aktif (atau fallback default 30 menit jika baris tidak ada)
    SELECT COALESCE((value->>'minutes')::INTEGER, 30)
    INTO v_patient_noshow_minutes
    FROM public.system_settings
    WHERE key = 'patient_noshow';
    v_patient_noshow_minutes := COALESCE(v_patient_noshow_minutes, 30);

    -- Setup auth.users & public.users dinamis
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES
        (v_psikolog_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_psi_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_pasien_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_pas_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

    INSERT INTO public.users (id, email, no_wa, role, status)
    VALUES
        (v_psikolog_id, v_psi_email, v_psi_wa, 'psikolog'::public.user_role, 'active'::public.account_status),
        (v_pasien_id, v_pas_email, v_pas_wa, 'pasien'::public.user_role, 'active'::public.account_status);

    INSERT INTO public.psikolog_profiles (
        user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
        spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins, suspended_until
    ) VALUES (
        v_psikolog_id, 'Dr. Psikolog Guard Test, M.Psi', 'SIPP-' || substr(replace(v_psikolog_id::text, '-', ''), 1, 8),
        'https://storage.test/sipp-guard.pdf', ARRAY['Depresi', 'Kecemasan'], 5, 150000, false, 2, NULL
    );

    INSERT INTO public.pasien_profiles (
        user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
    ) VALUES (
        v_pasien_id, 'Pasien Guard Test', 'Budi', 'Ibu Budi', '081100000282', false
    );

    INSERT INTO public.wallets (user_id, coin_balance, pending_rupiah, available_rupiah)
    VALUES
        (v_psikolog_id, 0, 0, 0),
        (v_pasien_id, 100, 0, 0);

    -- ----------------------------------------------------
    -- UJI 1: Penolakan end sebelum start_at (pg_catalog.now() < start_at)
    -- Harap: Exception SESSION_NOT_STARTED, status tetap in_progress, tanpa settlement
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        psikolog_first_msg_at, patient_first_msg_at
    ) VALUES (
        v_b1_id, v_pasien_id, v_psikolog_id, pg_catalog.now() + INTERVAL '30 minutes', 'in_progress',
        'Keluhan uji penolakan end sebelum sesi dimulai minimal dua puluh karakter.',
        15, 8500, '[]'::jsonb, 'Pasien Guard Test',
        NULL, NULL
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.session_end(v_b1_id, v_psikolog_id);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%SESSION_NOT_STARTED%' THEN
                v_err_caught := true;
            ELSE
                RAISE EXCEPTION 'UJI 1 GAGAL: Exception bukan SESSION_NOT_STARTED: %', SQLERRM;
            END IF;
    END;

    ASSERT v_err_caught = true, 'UJI 1 GAGAL: session_end harus melempar SESSION_NOT_STARTED saat now() < start_at';

    -- Pastikan booking tetap in_progress dan tidak ada settlement/earning
    SELECT COUNT(*) INTO v_earning_count FROM public.mitra_earnings WHERE source_id = v_b1_id;
    ASSERT v_earning_count = 0, 'UJI 1 GAGAL: Tidak boleh ada settlement saat session_end ditolak';

    PERFORM 1 FROM public.bookings WHERE id = v_b1_id AND status = 'in_progress';
    ASSERT FOUND, 'UJI 1 GAGAL: Status booking harus tetap in_progress';

    -- ----------------------------------------------------
    -- UJI 2: Penolakan bila pasien belum membalas sebelum batas no-show
    -- (now() > start_at, psikolog sudah kirim pesan, patient_first_msg_at IS NULL, batas belum lewat)
    -- Harap: Exception PATIENT_NO_SHOW_PENDING, status tetap in_progress, tanpa settlement
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        psikolog_first_msg_at, patient_first_msg_at
    ) VALUES (
        v_b2_id, v_pasien_id, v_psikolog_id, pg_catalog.now() - (v_patient_noshow_minutes * INTERVAL '1 minute'), 'in_progress',
        'Keluhan uji penolakan no-show pending sebelum batas waktu terlewati minimal dua puluh.',
        15, 8500, '[]'::jsonb, 'Pasien Guard Test',
        pg_catalog.now() - (GREATEST(v_patient_noshow_minutes / 2, 1) * INTERVAL '1 minute'), NULL
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.session_end(v_b2_id, v_psikolog_id);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%PATIENT_NO_SHOW_PENDING%' THEN
                v_err_caught := true;
            ELSE
                RAISE EXCEPTION 'UJI 2 GAGAL: Exception bukan PATIENT_NO_SHOW_PENDING: %', SQLERRM;
            END IF;
    END;

    ASSERT v_err_caught = true, 'UJI 2 GAGAL: session_end harus melempar PATIENT_NO_SHOW_PENDING sebelum batas no-show';

    SELECT COUNT(*) INTO v_earning_count FROM public.mitra_earnings WHERE source_id = v_b2_id;
    ASSERT v_earning_count = 0, 'UJI 2 GAGAL: Tidak boleh ada settlement saat no-show pending';

    -- ----------------------------------------------------
    -- UJI 3: Penolakan bila psikolog & pasien belum pernah mengirim pesan
    -- (now() > start_at, psikolog_first_msg_at IS NULL, patient_first_msg_at IS NULL)
    -- Harap: Exception PATIENT_NO_SHOW_PENDING, tanpa settlement
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        psikolog_first_msg_at, patient_first_msg_at
    ) VALUES (
        v_b3_id, v_pasien_id, v_psikolog_id, pg_catalog.now() - INTERVAL '15 minutes', 'in_progress',
        'Keluhan uji penolakan saat psikolog belum menyapa dan pasien belum menyapa dua puluh.',
        15, 8500, '[]'::jsonb, 'Pasien Guard Test',
        NULL, NULL
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.session_end(v_b3_id, v_psikolog_id);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%PATIENT_NO_SHOW_PENDING%' THEN
                v_err_caught := true;
            ELSE
                RAISE EXCEPTION 'UJI 3 GAGAL: Exception bukan PATIENT_NO_SHOW_PENDING: %', SQLERRM;
            END IF;
    END;

    ASSERT v_err_caught = true, 'UJI 3 GAGAL: session_end harus melempar PATIENT_NO_SHOW_PENDING jika psikolog belum menyapa';

    -- ----------------------------------------------------
    -- UJI 4: Sesi normal sesudah start_at dengan balasan pesan pasien
    -- (now() > start_at, psikolog dan pasien sudah saling bertukar pesan)
    -- Harap: Sukses completed, ended_at terisi, settlement terbentuk (15 * 10000 * 85% = 127500)
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        psikolog_first_msg_at, patient_first_msg_at
    ) VALUES (
        v_b4_id, v_pasien_id, v_psikolog_id, pg_catalog.now() - INTERVAL '25 minutes', 'in_progress',
        'Keluhan uji sesi normal berhasil diselesaikan psikolog dengan balasan pasien dua puluh.',
        15, 8500, '[]'::jsonb, 'Pasien Guard Test',
        pg_catalog.now() - INTERVAL '24 minutes', pg_catalog.now() - INTERVAL '20 minutes'
    );

    v_res := public.session_end(v_b4_id, v_psikolog_id);

    ASSERT v_res.status = 'completed', 'UJI 4 GAGAL: Status booking harus completed';
    ASSERT v_res.ended_at IS NOT NULL, 'UJI 4 GAGAL: ended_at harus terisi';

    -- Verifikasi earning sesi mitra terbentuk
    SELECT amount_rupiah INTO v_pending_balance
    FROM public.mitra_earnings
    WHERE source_type = 'session' AND source_id = v_b4_id;

    ASSERT v_pending_balance = 127500, 'UJI 4 GAGAL: Earning mitra harus 127500, didapat ' || COALESCE(v_pending_balance::text, 'NULL');

    -- Verifikasi wallet mitra ter-update
    SELECT pending_rupiah INTO v_pending_balance
    FROM public.wallets
    WHERE user_id = v_psikolog_id;

    ASSERT v_pending_balance = 127500, 'UJI 4 GAGAL: Wallet pending_rupiah mitra harus 127500, didapat ' || COALESCE(v_pending_balance::text, 'NULL');

    -- ----------------------------------------------------
    -- UJI 5: Pasien no-show tetapi batas waktu no-show telah terlewati
    -- (now() > start_at, psikolog menyapa lebih dari batas no-show lalu, patient_first_msg_at NULL)
    -- Harap: Sukses completed & settlement berhasil
    -- ----------------------------------------------------
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        psikolog_first_msg_at, patient_first_msg_at
    ) VALUES (
        v_b5_id, v_pasien_id, v_psikolog_id, pg_catalog.now() - ((v_patient_noshow_minutes + 10) * INTERVAL '1 minute'), 'in_progress',
        'Keluhan uji pasien tidak menyapa namun batas waktu no show telah lewat dua puluh.',
        15, 8500, '[]'::jsonb, 'Pasien Guard Test',
        pg_catalog.now() - ((v_patient_noshow_minutes + 5) * INTERVAL '1 minute'), NULL
    );

    v_res := public.session_end(v_b5_id, v_psikolog_id);

    ASSERT v_res.status = 'completed', 'UJI 5 GAGAL: Status booking harus completed setelah batas no-show lewat';

    SELECT amount_rupiah INTO v_pending_balance
    FROM public.mitra_earnings
    WHERE source_type = 'session' AND source_id = v_b5_id;

    ASSERT v_pending_balance = 127500, 'UJI 5 GAGAL: Earning mitra no-show setelah batas lewat harus 127500';

    -- ----------------------------------------------------
    -- UJI 6: Verifikasi kepatuhan fungsi (SECURITY DEFINER, search_path, & privilege EXECUTE)
    -- ----------------------------------------------------
    PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'session_end'
      AND p.prosecdef = true
      AND array_to_string(p.proconfig, ',') LIKE '%search_path=%';

    ASSERT FOUND, 'UJI 6a GAGAL: public.session_end harus SECURITY DEFINER dengan search_path eksplisit';

    -- Verifikasi katalog privilege EXECUTE untuk PUBLIC, anon, authenticated, dan service_role
    ASSERT has_function_privilege('public', 'public.session_end(uuid, uuid)', 'EXECUTE') = false,
        'UJI 6b GAGAL: PUBLIC dilarang memiliki hak EXECUTE pada public.session_end(uuid, uuid)';
    ASSERT has_function_privilege('anon', 'public.session_end(uuid, uuid)', 'EXECUTE') = false,
        'UJI 6c GAGAL: anon dilarang memiliki hak EXECUTE pada public.session_end(uuid, uuid)';
    ASSERT has_function_privilege('authenticated', 'public.session_end(uuid, uuid)', 'EXECUTE') = false,
        'UJI 6d GAGAL: authenticated dilarang memiliki hak EXECUTE pada public.session_end(uuid, uuid)';
    ASSERT has_function_privilege('service_role', 'public.session_end(uuid, uuid)', 'EXECUTE') = true,
        'UJI 6e GAGAL: service_role wajib memiliki hak EXECUTE pada public.session_end(uuid, uuid)';

    -- Verifikasi langsung entri ACL katalog pg_proc.proacl via aclexplode
    PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
    LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname = 'session_end'
      AND a.privilege_type = 'EXECUTE'
      AND a.grantee IN (0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid);

    ASSERT NOT FOUND, 'UJI 6f GAGAL: Entri ACL EXECUTE untuk PUBLIC/anon/authenticated ditemukan pada pg_proc.proacl';

    PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
    LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname = 'session_end'
      AND a.privilege_type = 'EXECUTE'
      AND a.grantee = 'service_role'::regrole::oid;

    ASSERT FOUND, 'UJI 6g GAGAL: Entri ACL EXECUTE untuk service_role wajib ada pada pg_proc.proacl';
END $$;

-- ========================================================
-- NOTIFIKASI KELULUSAN & TRANSAKSI ROLLBACK
-- ========================================================

DO $$
BEGIN
    RAISE NOTICE 'DRYRUN_OK';
END $$;

ROLLBACK;
