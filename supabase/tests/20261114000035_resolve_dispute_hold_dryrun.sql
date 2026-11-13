-- ========================================================
-- TEMAN BICARA: DRY-RUN MIGRATION 20261114000035 (RESOLVE DISPUTE HOLD)
-- Path: supabase/tests/20261114000035_resolve_dispute_hold_dryrun.sql
-- Scope:
-- 1. DDL salinan persis dari 20261114000035_resolve_dispute_hold.sql
-- 2. Setup fixture dinamis terisolasi (auth.users, public.users, topup_orders, bookings, wallets, disputed_payout_holds)
-- 3. Uji 1: Validasi penolakan argumen invalid & hold tidak ditemukan (HOLD_NOT_FOUND)
-- 4. Uji 2: Skenario clear (status cleared, audit tercatat, saldo wallets & ledger tidak berubah)
-- 5. Uji 3: Skenario deduct memotong available_rupiah terlebih dahulu (atomic ledger & wallets update)
-- 6. Uji 4: Skenario deduct meluber ke pending_rupiah saat available tidak cukup (2 ledger entries)
-- 7. Uji 5: Skenario deduct saat total saldo kurang (potong sebatas yang ada tanpa saldo negatif)
-- 8. Uji 6: Pencegahan double resolve pada status cleared/deducted (HOLD_ALREADY_RESOLVED)
-- 9. Uji 7: Verifikasi hak akses katalog (REVOKE PUBLIC/anon/authenticated, GRANT service_role)
-- 10. Diakhiri RAISE EXCEPTION 'DRYRUN_OK' dan ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. DDL SALINAN PERSIS DARI 20261114000035_resolve_dispute_hold.sql
-- ========================================================

ALTER TABLE public.disputed_payout_holds
    ADD COLUMN IF NOT EXISTS resolution_note TEXT,
    ADD COLUMN IF NOT EXISTS deducted_amount_rupiah BIGINT NOT NULL DEFAULT 0 CHECK (deducted_amount_rupiah >= 0);

COMMENT ON COLUMN public.disputed_payout_holds.resolution_note IS 'Catatan penjelasan admin saat membebaskan atau memotong saldo sengketa';
COMMENT ON COLUMN public.disputed_payout_holds.deducted_amount_rupiah IS 'Nominal rupiah aktual yang berhasil dipotong dari dompet mitra saat aksi deduct';

CREATE OR REPLACE FUNCTION public.resolve_dispute_hold(
    p_hold_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_hold public.disputed_payout_holds%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_target BIGINT;
    v_deduct_avail BIGINT := 0;
    v_deduct_pending BIGINT := 0;
    v_actual_deducted BIGINT := 0;
    v_updated_hold public.disputed_payout_holds%ROWTYPE;
    v_result JSONB;
BEGIN
    -- 1. Validasi argumen
    IF p_hold_id IS NULL OR p_admin_id IS NULL OR p_action IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS' USING ERRCODE = '22023';
    END IF;

    IF p_action NOT IN ('clear', 'deduct') THEN
        RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
    END IF;

    -- 2. Kunci baris sengketa FOR UPDATE
    SELECT * INTO v_hold
    FROM public.disputed_payout_holds
    WHERE id = p_hold_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HOLD_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_hold.status <> 'active' THEN
        RAISE EXCEPTION 'HOLD_ALREADY_RESOLVED' USING ERRCODE = 'P0001';
    END IF;

    -- 3. Aksi 'clear' (Bebaskan penahanan tanpa mutasi dompet/buku besar)
    IF p_action = 'clear' THEN
        UPDATE public.disputed_payout_holds
        SET status = 'cleared',
            resolved_at = pg_catalog.now(),
            resolved_by = p_admin_id,
            resolution_note = p_note,
            deducted_amount_rupiah = 0
        WHERE id = p_hold_id
        RETURNING * INTO v_updated_hold;

        v_result := pg_catalog.to_jsonb(v_updated_hold);
        RETURN v_result;
    END IF;

    -- 4. Aksi 'deduct' (Potong saldo bertingkat: available lalu pending)
    IF p_action = 'deduct' THEN
        -- Pastikan baris dompet mitra ada & kunci FOR UPDATE
        INSERT INTO public.wallets(user_id) VALUES(v_hold.mitra_id) ON CONFLICT(user_id) DO NOTHING;

        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_hold.mitra_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'WALLET_NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;

        -- Hitung pemotongan bertingkat
        v_target := v_hold.disputed_amount_rupiah;

        -- Porsi 1: potong dari available_rupiah sebatas saldo yang ada
        v_deduct_avail := pg_catalog.least(v_wallet.available_rupiah, v_target);
        IF v_deduct_avail < 0 THEN
            v_deduct_avail := 0;
        END IF;

        -- Porsi 2: sisa target dipotong dari pending_rupiah sebatas saldo yang ada
        v_deduct_pending := pg_catalog.least(v_wallet.pending_rupiah, v_target - v_deduct_avail);
        IF v_deduct_pending < 0 THEN
            v_deduct_pending := 0;
        END IF;

        v_actual_deducted := v_deduct_avail + v_deduct_pending;

        -- Perbarui saldo dompet mitra
        IF v_actual_deducted > 0 THEN
            UPDATE public.wallets
            SET available_rupiah = available_rupiah - v_deduct_avail,
                pending_rupiah = pending_rupiah - v_deduct_pending,
                updated_at = pg_catalog.now()
            WHERE user_id = v_hold.mitra_id;
        END IF;

        -- Catat baris pembalik ke ledger_entries untuk tiap akun yang terpotong > 0
        IF v_deduct_avail > 0 THEN
            INSERT INTO public.ledger_entries (
                user_id,
                account,
                amount,
                unit,
                reason,
                ref_type,
                ref_id
            ) VALUES (
                v_hold.mitra_id,
                'mitra_available',
                -v_deduct_avail,
                'rupiah',
                'dispute_deduct',
                'dispute_hold',
                p_hold_id
            );
        END IF;

        IF v_deduct_pending > 0 THEN
            INSERT INTO public.ledger_entries (
                user_id,
                account,
                amount,
                unit,
                reason,
                ref_type,
                ref_id
            ) VALUES (
                v_hold.mitra_id,
                'mitra_pending',
                -v_deduct_pending,
                'rupiah',
                'dispute_deduct',
                'dispute_hold',
                p_hold_id
            );
        END IF;

        -- Perbarui metadata sengketa hold
        UPDATE public.disputed_payout_holds
        SET status = 'deducted',
            resolved_at = pg_catalog.now(),
            resolved_by = p_admin_id,
            resolution_note = p_note,
            deducted_amount_rupiah = v_actual_deducted
        WHERE id = p_hold_id
        RETURNING * INTO v_updated_hold;

        v_result := pg_catalog.to_jsonb(v_updated_hold);
        RETURN v_result;
    END IF;

    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.resolve_dispute_hold(UUID, UUID, TEXT, TEXT) IS 'RPC untuk menyelesaikan sengketa hold payout mitra (clear atau deduct bertingkat) secara atomik';

-- ========================================================
-- 2. EKSEKUSI PENGUJIAN LOGIKA & ATRIBUT DATA
-- ========================================================

DO $$
DECLARE
    -- ID unik dinamis untuk isolasi pengujian
    v_admin_id UUID := pg_catalog.gen_random_uuid();
    v_psikolog_id UUID := pg_catalog.gen_random_uuid();
    v_pasien_id UUID := pg_catalog.gen_random_uuid();

    v_adm_email TEXT := 'adm_dispute_' || pg_catalog.substr(pg_catalog.replace(v_admin_id::text, '-', ''), 1, 12) || '@temanbicara.test';
    v_psi_email TEXT := 'psi_dispute_' || pg_catalog.substr(pg_catalog.replace(v_psikolog_id::text, '-', ''), 1, 12) || '@temanbicara.test';
    v_pas_email TEXT := 'pas_dispute_' || pg_catalog.substr(pg_catalog.replace(v_pasien_id::text, '-', ''), 1, 12) || '@temanbicara.test';

    v_topup_id UUID := pg_catalog.gen_random_uuid();
    v_booking_id UUID := pg_catalog.gen_random_uuid();

    v_hold_clear_id UUID := pg_catalog.gen_random_uuid();
    v_hold_deduct_avail_id UUID := pg_catalog.gen_random_uuid();
    v_hold_overflow_id UUID := pg_catalog.gen_random_uuid();
    v_hold_insufficient_id UUID := pg_catalog.gen_random_uuid();

    v_res_json JSONB;
    v_hold_rec RECORD;
    v_wallet_rec RECORD;
    v_ledger_count INTEGER;
    v_ledger_rec RECORD;
    v_caught_exception BOOLEAN;
BEGIN
    -- Setup auth.users & public.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES
        (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_adm_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_psikolog_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_psi_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_pasien_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_pas_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

    INSERT INTO public.users (id, email, no_wa, role, status)
    VALUES
        (v_admin_id, v_adm_email, '0811' || pg_catalog.substr(pg_catalog.replace(v_admin_id::text, '-', ''), 1, 8), 'admin'::public.user_role, 'active'::public.account_status),
        (v_psikolog_id, v_psi_email, '0812' || pg_catalog.substr(pg_catalog.replace(v_psikolog_id::text, '-', ''), 1, 8), 'psikolog'::public.user_role, 'active'::public.account_status),
        (v_pasien_id, v_pas_email, '0813' || pg_catalog.substr(pg_catalog.replace(v_pasien_id::text, '-', ''), 1, 8), 'pasien'::public.user_role, 'active'::public.account_status);

    INSERT INTO public.admin_profiles (user_id, nama_lengkap, level)
    VALUES (v_admin_id, 'Admin Dispute Tester', 'superadmin');

    INSERT INTO public.psikolog_profiles (
        user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
        spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins
    ) VALUES (
        v_psikolog_id, 'Psikolog Dispute Resolve, M.Psi', 'SIPP-' || pg_catalog.substr(pg_catalog.replace(v_psikolog_id::text, '-', ''), 1, 8),
        'https://storage.test/sipp.pdf', ARRAY['Trauma'], 5, 100000, false, 2
    );

    INSERT INTO public.pasien_profiles (
        user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
    ) VALUES (
        v_pasien_id, 'Pasien Dispute', 'Pas', 'Keluarga Pas', '081199990002', false
    );

    -- Setup topup order & booking
    INSERT INTO public.topup_orders (
        id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at
    ) VALUES (
        v_topup_id, 'TOPUP-DISPUTE-RESOLVE-001', v_pasien_id, 20, 200000,
        'settlement'::public.payment_status, 'provider-ref-001', pg_catalog.now() - INTERVAL '2 days', pg_catalog.now() - INTERVAL '2 days'
    );

    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name, created_at
    ) VALUES (
        v_booking_id, v_pasien_id, v_psikolog_id, pg_catalog.now() - INTERVAL '1 day', 'completed',
        'Keluhan uji resolusi sengketa minimal dua puluh karakter terdaftar.',
        10, 8000, '[]'::jsonb, 'Pasien Uji', pg_catalog.now() - INTERVAL '1 day'
    );

    -- Setup 4 entri disputed_payout_holds untuk 4 skenario uji
    INSERT INTO public.disputed_payout_holds (
        id, topup_order_id, mitra_id, source_type, source_id, disputed_amount_rupiah, status, reason
    ) VALUES
        (v_hold_clear_id, v_topup_id, v_psikolog_id, 'session', v_booking_id, 250000, 'active', 'Hold untuk uji clear'),
        (v_hold_deduct_avail_id, v_topup_id, v_psikolog_id, 'extension', v_booking_id, 100000, 'active', 'Hold untuk uji deduct available'),
        (v_hold_overflow_id, v_topup_id, v_psikolog_id, 'tip', pg_catalog.gen_random_uuid(), 200000, 'active', 'Hold untuk uji deduct overflow pending'),
        (v_hold_insufficient_id, v_topup_id, v_psikolog_id, 'tip', pg_catalog.gen_random_uuid(), 100000, 'active', 'Hold untuk uji deduct saldo kurang');

    -- ====================================================
    -- UJI 1: Validasi Argumen & Hold Not Found
    -- ====================================================
    v_caught_exception := false;
    BEGIN
        PERFORM public.resolve_dispute_hold(NULL, v_admin_id, 'clear', 'Catatan');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%INVALID_ARGUMENTS%' THEN
                v_caught_exception := true;
            END IF;
    END;
    ASSERT v_caught_exception = true, 'UJI 1a GAGAL: Argument NULL wajib melempar INVALID_ARGUMENTS';

    v_caught_exception := false;
    BEGIN
        PERFORM public.resolve_dispute_hold(v_hold_clear_id, v_admin_id, 'invalid_action', 'Catatan');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%INVALID_ACTION%' THEN
                v_caught_exception := true;
            END IF;
    END;
    ASSERT v_caught_exception = true, 'UJI 1b GAGAL: Action di luar clear/deduct wajib melempar INVALID_ACTION';

    v_caught_exception := false;
    BEGIN
        PERFORM public.resolve_dispute_hold(pg_catalog.gen_random_uuid(), v_admin_id, 'clear', 'Catatan');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%HOLD_NOT_FOUND%' THEN
                v_caught_exception := true;
            END IF;
    END;
    ASSERT v_caught_exception = true, 'UJI 1c GAGAL: Hold ID tidak ada wajib melempar HOLD_NOT_FOUND';

    -- ====================================================
    -- UJI 2: Skenario Aksi 'clear'
    -- Saldo dompet awal: available Rp 1.000.000, pending Rp 300.000
    -- Nominal hold: Rp 250.000
    -- Ekspektasi: status cleared, deducted_amount = 0, saldo dompet tidak berubah, ledger bersih
    -- ====================================================
    INSERT INTO public.wallets (user_id, available_rupiah, pending_rupiah, coin_balance)
    VALUES (v_psikolog_id, 1000000, 300000, 0)
    ON CONFLICT (user_id) DO UPDATE
    SET available_rupiah = 1000000, pending_rupiah = 300000, coin_balance = 0;

    v_res_json := public.resolve_dispute_hold(v_hold_clear_id, v_admin_id, 'clear', 'Mitra tidak bersalah, transaksi valid');

    ASSERT (v_res_json->>'status') = 'cleared', 'UJI 2a GAGAL: Return status wajib cleared';
    ASSERT (v_res_json->>'deducted_amount_rupiah')::BIGINT = 0, 'UJI 2b GAGAL: Return deducted_amount_rupiah wajib 0';
    ASSERT (v_res_json->>'resolution_note') = 'Mitra tidak bersalah, transaksi valid', 'UJI 2c GAGAL: Return resolution_note cocok';

    -- Verifikasi baris hold di tabel
    SELECT * INTO v_hold_rec FROM public.disputed_payout_holds WHERE id = v_hold_clear_id;
    ASSERT v_hold_rec.status = 'cleared', 'UJI 2d GAGAL: Status tabel harus cleared';
    ASSERT v_hold_rec.deducted_amount_rupiah = 0, 'UJI 2e GAGAL: Deducted amount harus 0';
    ASSERT v_hold_rec.resolution_note = 'Mitra tidak bersalah, transaksi valid', 'UJI 2f GAGAL: Resolution note tersimpan';
    ASSERT v_hold_rec.resolved_by = v_admin_id, 'UJI 2g GAGAL: Resolved by harus admin id';
    ASSERT v_hold_rec.resolved_at IS NOT NULL, 'UJI 2h GAGAL: Resolved at harus terisi';

    -- Verifikasi saldo dompet TIDAK berubah
    SELECT * INTO v_wallet_rec FROM public.wallets WHERE user_id = v_psikolog_id;
    ASSERT v_wallet_rec.available_rupiah = 1000000, 'UJI 2i GAGAL: Available rupiah tidak boleh berkurang pada aksi clear';
    ASSERT v_wallet_rec.pending_rupiah = 300000, 'UJI 2j GAGAL: Pending rupiah tidak boleh berkurang pada aksi clear';

    -- Verifikasi tidak ada baris ledger yang dibuat
    SELECT COUNT(*) INTO v_ledger_count FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_clear_id;
    ASSERT v_ledger_count = 0, 'UJI 2k GAGAL: Aksi clear dilarang menerbitkan ledger entry';

    -- ====================================================
    -- UJI 3: Skenario Aksi 'deduct' - Memotong available_rupiah terlebih dahulu
    -- Saldo dompet: available Rp 500.000, pending Rp 200.000
    -- Nominal hold: Rp 100.000
    -- Ekspektasi: available terpotong Rp 100.000 (sisa 400.000), pending tetap 200.000, deducted = 100.000, 1 entri ledger mitra_available
    -- ====================================================
    UPDATE public.wallets
    SET available_rupiah = 500000, pending_rupiah = 200000
    WHERE user_id = v_psikolog_id;

    v_res_json := public.resolve_dispute_hold(v_hold_deduct_avail_id, v_admin_id, 'deduct', 'Chargeback diputuskan oleh bank penerbit');

    ASSERT (v_res_json->>'status') = 'deducted', 'UJI 3a GAGAL: Return status wajib deducted';
    ASSERT (v_res_json->>'deducted_amount_rupiah')::BIGINT = 100000, 'UJI 3b GAGAL: Return deducted_amount_rupiah wajib 100.000';

    SELECT * INTO v_hold_rec FROM public.disputed_payout_holds WHERE id = v_hold_deduct_avail_id;
    ASSERT v_hold_rec.status = 'deducted', 'UJI 3c GAGAL: Status tabel harus deducted';
    ASSERT v_hold_rec.deducted_amount_rupiah = 100000, 'UJI 3d GAGAL: Deducted amount harus 100.000';
    ASSERT v_hold_rec.resolution_note = 'Chargeback diputuskan oleh bank penerbit', 'UJI 3e GAGAL: Resolution note tersimpan';

    SELECT * INTO v_wallet_rec FROM public.wallets WHERE user_id = v_psikolog_id;
    ASSERT v_wallet_rec.available_rupiah = 400000, 'UJI 3f GAGAL: Available rupiah harus berkurang menjadi 400.000';
    ASSERT v_wallet_rec.pending_rupiah = 200000, 'UJI 3g GAGAL: Pending rupiah tidak boleh berkurang';

    SELECT COUNT(*) INTO v_ledger_count FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_deduct_avail_id;
    ASSERT v_ledger_count = 1, 'UJI 3h GAGAL: Tepat 1 ledger entry untuk pemotongan available';

    SELECT * INTO v_ledger_rec FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_deduct_avail_id;
    ASSERT v_ledger_rec.account = 'mitra_available', 'UJI 3i GAGAL: Akun ledger harus mitra_available';
    ASSERT v_ledger_rec.amount = -100000, 'UJI 3j GAGAL: Nominal ledger harus -100.000';
    ASSERT v_ledger_rec.unit = 'rupiah', 'UJI 3k GAGAL: Unit ledger harus rupiah';
    ASSERT v_ledger_rec.reason = 'dispute_deduct', 'UJI 3l GAGAL: Reason ledger harus dispute_deduct';

    -- ====================================================
    -- UJI 4: Skenario Aksi 'deduct' - Meluber ke pending_rupiah saat available tidak cukup
    -- Saldo dompet: available Rp 50.000, pending Rp 300.000
    -- Nominal hold: Rp 200.000
    -- Ekspektasi: available habis (0), pending terpotong 150.000 (sisa 150.000), deducted = 200.000, 2 entri ledger
    -- ====================================================
    UPDATE public.wallets
    SET available_rupiah = 50000, pending_rupiah = 300000
    WHERE user_id = v_psikolog_id;

    v_res_json := public.resolve_dispute_hold(v_hold_overflow_id, v_admin_id, 'deduct', 'Deduct meluber ke pending');

    ASSERT (v_res_json->>'status') = 'deducted', 'UJI 4a GAGAL: Return status wajib deducted';
    ASSERT (v_res_json->>'deducted_amount_rupiah')::BIGINT = 200000, 'UJI 4b GAGAL: Return deducted_amount_rupiah wajib 200.000';

    SELECT * INTO v_hold_rec FROM public.disputed_payout_holds WHERE id = v_hold_overflow_id;
    ASSERT v_hold_rec.deducted_amount_rupiah = 200000, 'UJI 4c GAGAL: Deducted amount harus 200.000';

    SELECT * INTO v_wallet_rec FROM public.wallets WHERE user_id = v_psikolog_id;
    ASSERT v_wallet_rec.available_rupiah = 0, 'UJI 4d GAGAL: Available rupiah harus habis menjadi 0';
    ASSERT v_wallet_rec.pending_rupiah = 150000, 'UJI 4e GAGAL: Pending rupiah harus bersisa 150.000';

    SELECT COUNT(*) INTO v_ledger_count FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_overflow_id;
    ASSERT v_ledger_count = 2, 'UJI 4f GAGAL: Wajib menerbitkan tepat 2 entri ledger (available & pending)';

    SELECT * INTO v_ledger_rec FROM public.ledger_entries
    WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_overflow_id AND account = 'mitra_available';
    ASSERT FOUND AND v_ledger_rec.amount = -50000, 'UJI 4g GAGAL: Entri mitra_available harus -50.000';

    SELECT * INTO v_ledger_rec FROM public.ledger_entries
    WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_overflow_id AND account = 'mitra_pending';
    ASSERT FOUND AND v_ledger_rec.amount = -150000, 'UJI 4h GAGAL: Entri mitra_pending harus -150.000';

    -- ====================================================
    -- UJI 5: Skenario Aksi 'deduct' - Saldo total dompet tidak mencukupi
    -- Saldo dompet: available Rp 30.000, pending Rp 0
    -- Nominal hold: Rp 100.000
    -- Ekspektasi: potong sebatas saldo ada (available 0, pending 0), deducted = 30.000, tanpa error constraint negatif
    -- ====================================================
    UPDATE public.wallets
    SET available_rupiah = 30000, pending_rupiah = 0
    WHERE user_id = v_psikolog_id;

    v_res_json := public.resolve_dispute_hold(v_hold_insufficient_id, v_admin_id, 'deduct', 'Potong sebatas saldo ada');

    ASSERT (v_res_json->>'status') = 'deducted', 'UJI 5a GAGAL: Return status wajib deducted';
    ASSERT (v_res_json->>'deducted_amount_rupiah')::BIGINT = 30000, 'UJI 5b GAGAL: Return deducted_amount_rupiah wajib 30.000';

    SELECT * INTO v_hold_rec FROM public.disputed_payout_holds WHERE id = v_hold_insufficient_id;
    ASSERT v_hold_rec.deducted_amount_rupiah = 30000, 'UJI 5c GAGAL: Deducted amount harus 30.000';

    SELECT * INTO v_wallet_rec FROM public.wallets WHERE user_id = v_psikolog_id;
    ASSERT v_wallet_rec.available_rupiah = 0, 'UJI 5d GAGAL: Available rupiah harus 0';
    ASSERT v_wallet_rec.pending_rupiah = 0, 'UJI 5e GAGAL: Pending rupiah harus 0';

    SELECT COUNT(*) INTO v_ledger_count FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_insufficient_id;
    ASSERT v_ledger_count = 1, 'UJI 5f GAGAL: Tepat 1 ledger entry untuk pemotongan 30.000';

    SELECT * INTO v_ledger_rec FROM public.ledger_entries WHERE ref_type = 'dispute_hold' AND ref_id = v_hold_insufficient_id;
    ASSERT v_ledger_rec.amount = -30000, 'UJI 5g GAGAL: Entri amount harus -30.000';

    -- ====================================================
    -- UJI 6: Pencegahan Double Resolve (Idempotensi 409 HOLD_ALREADY_RESOLVED)
    -- ====================================================
    v_caught_exception := false;
    BEGIN
        PERFORM public.resolve_dispute_hold(v_hold_clear_id, v_admin_id, 'clear', 'Coba clear ulang');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%HOLD_ALREADY_RESOLVED%' THEN
                v_caught_exception := true;
            END IF;
    END;
    ASSERT v_caught_exception = true, 'UJI 6a GAGAL: Resolve ulang hold cleared wajib ditolak HOLD_ALREADY_RESOLVED';

    v_caught_exception := false;
    BEGIN
        PERFORM public.resolve_dispute_hold(v_hold_deduct_avail_id, v_admin_id, 'deduct', 'Coba deduct ulang');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%HOLD_ALREADY_RESOLVED%' THEN
                v_caught_exception := true;
            END IF;
    END;
    ASSERT v_caught_exception = true, 'UJI 6b GAGAL: Resolve ulang hold deducted wajib ditolak HOLD_ALREADY_RESOLVED';

    -- ====================================================
    -- UJI 7: Verifikasi Hak Akses Katalog (Privileges)
    -- ====================================================
    ASSERT has_function_privilege('public', 'public.resolve_dispute_hold(uuid,uuid,text,text)', 'EXECUTE') = false,
        'UJI 7a GAGAL: PUBLIC dilarang memiliki hak EXECUTE pada public.resolve_dispute_hold';
    ASSERT has_function_privilege('anon', 'public.resolve_dispute_hold(uuid,uuid,text,text)', 'EXECUTE') = false,
        'UJI 7b GAGAL: anon dilarang memiliki hak EXECUTE pada public.resolve_dispute_hold';
    ASSERT has_function_privilege('authenticated', 'public.resolve_dispute_hold(uuid,uuid,text,text)', 'EXECUTE') = false,
        'UJI 7c GAGAL: authenticated dilarang memiliki hak EXECUTE pada public.resolve_dispute_hold';
    ASSERT has_function_privilege('service_role', 'public.resolve_dispute_hold(uuid,uuid,text,text)', 'EXECUTE') = true,
        'UJI 7d GAGAL: service_role wajib memiliki hak EXECUTE pada public.resolve_dispute_hold';

    -- Akhiri seluruh pengujian sukses dengan melempar penanda DRYRUN_OK
    RAISE EXCEPTION 'DRYRUN_OK';
END $$;

ROLLBACK;
