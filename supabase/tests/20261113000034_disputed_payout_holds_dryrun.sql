-- ========================================================
-- TEMAN BICARA: DRY-RUN MIGRATION 20261113000034 (DISPUTED PAYOUT HOLDS)
-- Path: supabase/tests/20261113000034_disputed_payout_holds_dryrun.sql
-- Scope:
-- 1. DDL salinan persis dari 20261113000034_disputed_payout_holds.sql
-- 2. Setup fixture dinamis & terisolasi (auth.users, public.users, topup_orders, bookings, tips, mitra_earnings)
-- 3. Uji 1: Parameter null / invalid / non-existent / pending order (settled_at NULL) -> return 0 tanpa error
-- 4. Uji 2: Taint Overlap Window normal:
--    - Earning sebelum settled_at tidak disentuh
--    - Earning session (50.000) dan extension (20.000) ter-hold penuh
--    - Earning tip (30.000) ter-hold parsial (10.000) sesuai plafon 80% (80.000)
--    - Earning tip berikutnya (20.000) tidak ter-hold karena plafon sudah tercapai
--    - Total 3 hold terbentuk, total nilai tepat Rp 80.000, status 'active'
-- 5. Uji 3: Idempotensi & retry safety:
--    - Pemanggilan ulang RPC create_dispute_holds pada order yang sama mengembalikan 0
--    - Tidak ada baris duplikat yang tercipta
-- 6. Uji 4: Penegakan constraint unik (topup_order_id, source_type, source_id)
-- 7. Uji 5: Verifikasi katalog hak istimewa (REVOKE dari PUBLIC, anon, authenticated; GRANT ke service_role)
-- 8. Diakhiri RAISE EXCEPTION 'DRYRUN_OK' dan ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. DDL SALINAN PERSIS DARI 20261113000034_disputed_payout_holds.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.disputed_payout_holds (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    topup_order_id UUID NOT NULL REFERENCES public.topup_orders(id) ON DELETE RESTRICT,
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    source_type TEXT NOT NULL CHECK (source_type IN ('session', 'extension', 'tip')),
    source_id UUID NOT NULL,
    disputed_amount_rupiah BIGINT NOT NULL CHECK (disputed_amount_rupiah > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleared', 'deducted')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT disputed_payout_unique_source UNIQUE (topup_order_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS disputed_payout_mitra_idx ON public.disputed_payout_holds(mitra_id, status);

ALTER TABLE public.disputed_payout_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.disputed_payout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.disputed_payout_holds TO service_role;

CREATE OR REPLACE FUNCTION public.create_dispute_holds(
    p_topup_order_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
    v_settled_at TIMESTAMPTZ;
    v_coins BIGINT;
    v_cap_rupiah BIGINT;
    v_accumulated_rupiah BIGINT := 0;
    v_holds_created INTEGER := 0;
    v_rec RECORD;
    v_hold_amount BIGINT;
    v_inserted_id UUID;
BEGIN
    IF p_topup_order_id IS NULL THEN
        RETURN 0;
    END IF;

    -- 1. Ambil data pesanan topup
    SELECT patient_id, settled_at, coins
    INTO v_patient_id, v_settled_at, v_coins
    FROM public.topup_orders
    WHERE id = p_topup_order_id;

    IF NOT FOUND OR v_settled_at IS NULL OR v_coins IS NULL OR v_coins <= 0 THEN
        RETURN 0;
    END IF;

    -- 2. Plafon rupiah bagi hasil mitra (80% dari total nominal rupiah koin)
    v_cap_rupiah := (v_coins * 10000 * 80) / 100;
    IF v_cap_rupiah <= 0 THEN
        RETURN 0;
    END IF;

    -- 3. Akumulasi hold yang sudah terbentuk untuk order topup ini (idempoten / retry safety)
    SELECT COALESCE(pg_catalog.sum(disputed_amount_rupiah), 0)
    INTO v_accumulated_rupiah
    FROM public.disputed_payout_holds
    WHERE topup_order_id = p_topup_order_id;

    IF v_accumulated_rupiah >= v_cap_rupiah THEN
        RETURN 0;
    END IF;

    -- 4. Tracing Taint Overlap Window ke mitra_earnings pasien pasca settled_at
    FOR v_rec IN (
        SELECT
            me.id AS earning_id,
            me.mitra_id,
            me.source_type,
            me.source_id,
            me.amount_rupiah,
            me.created_at
        FROM public.mitra_earnings me
        JOIN public.bookings b
          ON me.source_id = b.id
        WHERE me.source_type IN ('session', 'extension')
          AND b.patient_id = v_patient_id
          AND me.created_at >= v_settled_at
          AND NOT EXISTS (
              SELECT 1 FROM public.disputed_payout_holds dph
              WHERE dph.topup_order_id = p_topup_order_id
                AND dph.source_type = me.source_type
                AND dph.source_id = me.source_id
          )

        UNION ALL

        SELECT
            me.id AS earning_id,
            me.mitra_id,
            me.source_type,
            me.source_id,
            me.amount_rupiah,
            me.created_at
        FROM public.mitra_earnings me
        JOIN public.tips t
          ON me.source_id = t.id
        WHERE me.source_type = 'tip'
          AND t.patient_id = v_patient_id
          AND me.created_at >= v_settled_at
          AND NOT EXISTS (
              SELECT 1 FROM public.disputed_payout_holds dph
              WHERE dph.topup_order_id = p_topup_order_id
                AND dph.source_type = me.source_type
                AND dph.source_id = me.source_id
          )

        ORDER BY created_at ASC, earning_id ASC
    ) LOOP
        -- Batasi akumulasi hold sesuai plafon rupiah
        IF v_rec.amount_rupiah <= (v_cap_rupiah - v_accumulated_rupiah) THEN
            v_hold_amount := v_rec.amount_rupiah;
        ELSE
            v_hold_amount := v_cap_rupiah - v_accumulated_rupiah;
        END IF;

        IF v_hold_amount <= 0 THEN
            EXIT;
        END IF;

        v_inserted_id := NULL;

        INSERT INTO public.disputed_payout_holds (
            topup_order_id,
            mitra_id,
            source_type,
            source_id,
            disputed_amount_rupiah,
            status,
            reason
        ) VALUES (
            p_topup_order_id,
            v_rec.mitra_id,
            v_rec.source_type,
            v_rec.source_id,
            v_hold_amount,
            'active',
            'Penahanan sengketa pembayaran atas pesanan topup ' || p_topup_order_id::text
        )
        ON CONFLICT (topup_order_id, source_type, source_id) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            v_holds_created := v_holds_created + 1;
            v_accumulated_rupiah := v_accumulated_rupiah + v_hold_amount;

            IF v_accumulated_rupiah >= v_cap_rupiah THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;

    RETURN v_holds_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dispute_holds(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispute_holds(UUID) TO service_role;

-- ========================================================
-- 2. EKSEKUSI PENGUJIAN LOGIKA & ATRIBUT DATA
-- ========================================================

DO $$
DECLARE
    -- ID unik dinamis untuk isolasi pengujian
    v_pasien_id UUID := pg_catalog.gen_random_uuid();
    v_psikolog_id UUID := pg_catalog.gen_random_uuid();
    v_relawan_id UUID := pg_catalog.gen_random_uuid();

    v_pas_email TEXT := 'dispute_pas_' || pg_catalog.replace(v_pasien_id::text, '-', '') || '@temanbicara.test';
    v_psi_email TEXT := 'dispute_psi_' || pg_catalog.replace(v_psikolog_id::text, '-', '') || '@temanbicara.test';
    v_rel_email TEXT := 'dispute_rel_' || pg_catalog.replace(v_relawan_id::text, '-', '') || '@temanbicara.test';

    v_topup_settled_id UUID := pg_catalog.gen_random_uuid();
    v_topup_pending_id UUID := pg_catalog.gen_random_uuid();

    v_booking_old_id UUID := pg_catalog.gen_random_uuid();
    v_booking_active_id UUID := pg_catalog.gen_random_uuid();
    v_tip_active_id UUID := pg_catalog.gen_random_uuid();
    v_tip_extra_id UUID := pg_catalog.gen_random_uuid();

    v_earning_old_id UUID := pg_catalog.gen_random_uuid();
    v_earning_session_id UUID := pg_catalog.gen_random_uuid();
    v_earning_ext_id UUID := pg_catalog.gen_random_uuid();
    v_earning_tip_id UUID := pg_catalog.gen_random_uuid();
    v_earning_extra_id UUID := pg_catalog.gen_random_uuid();

    v_res_count INTEGER;
    v_total_held BIGINT;
    v_hold_rec RECORD;
    v_unique_violation_caught BOOLEAN := false;
BEGIN
    -- Setup auth.users & public.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES
        (v_pasien_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_pas_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_psikolog_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_psi_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
        (v_relawan_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_rel_email, '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

    INSERT INTO public.users (id, email, no_wa, role, status)
    VALUES
        (v_pasien_id, v_pas_email, '0812' || pg_catalog.substr(pg_catalog.replace(v_pasien_id::text, '-', ''), 1, 8), 'pasien'::public.user_role, 'active'::public.account_status),
        (v_psikolog_id, v_psi_email, '0813' || pg_catalog.substr(pg_catalog.replace(v_psikolog_id::text, '-', ''), 1, 8), 'psikolog'::public.user_role, 'active'::public.account_status),
        (v_relawan_id, v_rel_email, '0814' || pg_catalog.substr(pg_catalog.replace(v_relawan_id::text, '-', ''), 1, 8), 'relawan'::public.user_role, 'active'::public.account_status);

    INSERT INTO public.psikolog_profiles (
        user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url,
        spesialisasi, tahun_pengalaman, tarif_sesi, booking_paused, extension_price_coins
    ) VALUES (
        v_psikolog_id, 'Psikolog Dispute Test, M.Psi', 'SIPP-' || pg_catalog.substr(pg_catalog.replace(v_psikolog_id::text, '-', ''), 1, 8),
        'https://storage.test/sipp-dispute.pdf', ARRAY['Trauma', 'Sengketa'], 5, 150000, false, 2
    );

    INSERT INTO public.pasien_profiles (
        user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default
    ) VALUES (
        v_pasien_id, 'Pasien Dispute Test', 'Uji', 'Keluarga Uji', '081199990001', false
    );

    -- Setup topup orders:
    -- Order 1: 10 koin (Rp 100.000), settled_at 2 hari lalu. Plafon hold 80% = Rp 80.000
    INSERT INTO public.topup_orders (
        id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at
    ) VALUES (
        v_topup_settled_id, 'TOPUP-DISPUTE-001', v_pasien_id, 10, 100000,
        'settlement'::public.payment_status, 'midtrans-ref-settled-001',
        pg_catalog.now() - INTERVAL '2 days', pg_catalog.now() - INTERVAL '2 days'
    );

    -- Order 2: pending (settled_at NULL)
    INSERT INTO public.topup_orders (
        id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at
    ) VALUES (
        v_topup_pending_id, 'TOPUP-DISPUTE-002', v_pasien_id, 10, 100000,
        'pending'::public.payment_status, NULL, NULL, pg_catalog.now()
    );

    -- Setup bookings & tips:
    -- 1. Booking lama SEBELUM top-up 1 settled_at (3 hari lalu)
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name, created_at
    ) VALUES (
        v_booking_old_id, v_pasien_id, v_psikolog_id,
        pg_catalog.now() - INTERVAL '3 days', 'completed',
        'Keluhan uji sebelum settled_at minimal dua puluh karakter terdaftar.',
        10, 8000, '[]'::jsonb, 'Pasien Uji', pg_catalog.now() - INTERVAL '3 days'
    );

    INSERT INTO public.mitra_earnings (
        id, mitra_id, amount_rupiah, source_type, source_id, available_at, created_at
    ) VALUES (
        v_earning_old_id, v_psikolog_id, 50000, 'session', v_booking_old_id,
        pg_catalog.now() - INTERVAL '1 day', pg_catalog.now() - INTERVAL '3 days'
    );

    -- 2. Booking aktif SETELAH top-up 1 settled_at (1 hari lalu): session (50.000) dan extension (20.000)
    INSERT INTO public.bookings (
        id, patient_id, psikolog_id, start_at, status, keluhan,
        price_coins, mitra_share_bps, refund_policy, patient_display_name,
        extension_status, extension_coins, created_at
    ) VALUES (
        v_booking_active_id, v_pasien_id, v_psikolog_id,
        pg_catalog.now() - INTERVAL '1 day', 'completed',
        'Keluhan uji sesudah settled_at minimal dua puluh karakter terdaftar.',
        10, 8000, '[]'::jsonb, 'Pasien Uji',
        'approved', 2, pg_catalog.now() - INTERVAL '1 day'
    );

    INSERT INTO public.mitra_earnings (
        id, mitra_id, amount_rupiah, source_type, source_id, available_at, created_at
    ) VALUES
        (v_earning_session_id, v_psikolog_id, 50000, 'session', v_booking_active_id, pg_catalog.now() + INTERVAL '1 day', pg_catalog.now() - INTERVAL '1 day'),
        (v_earning_ext_id, v_psikolog_id, 20000, 'extension', v_booking_active_id, pg_catalog.now() + INTERVAL '1 day', pg_catalog.now() - INTERVAL '20 hours');

    -- 3. Tip aktif 1 SETELAH top-up 1 settled_at (10 jam lalu, nominal 30.000)
    INSERT INTO public.tips (
        id, patient_id, mitra_id, coins, mitra_share_bps, source_type, source_id, created_at
    ) VALUES (
        v_tip_active_id, v_pasien_id, v_psikolog_id, 3, 10000, 'session', v_booking_active_id,
        pg_catalog.now() - INTERVAL '10 hours'
    );

    INSERT INTO public.mitra_earnings (
        id, mitra_id, amount_rupiah, source_type, source_id, available_at, created_at
    ) VALUES (
        v_earning_tip_id, v_psikolog_id, 30000, 'tip', v_tip_active_id, pg_catalog.now() + INTERVAL '1 day', pg_catalog.now() - INTERVAL '10 hours'
    );

    -- 4. Tip aktif 2 SETELAH top-up 1 settled_at (5 jam lalu, nominal 20.000)
    INSERT INTO public.tips (
        id, patient_id, mitra_id, coins, mitra_share_bps, source_type, source_id, created_at
    ) VALUES (
        v_tip_extra_id, v_pasien_id, v_psikolog_id, 2, 10000, 'session', v_booking_active_id,
        pg_catalog.now() - INTERVAL '5 hours'
    );

    INSERT INTO public.mitra_earnings (
        id, mitra_id, amount_rupiah, source_type, source_id, available_at, created_at
    ) VALUES (
        v_earning_extra_id, v_psikolog_id, 20000, 'tip', v_tip_extra_id, pg_catalog.now() + INTERVAL '1 day', pg_catalog.now() - INTERVAL '5 hours'
    );

    -- ====================================================
    -- UJI 1: Parameter Invalid, Non-Existent, atau Pending Order
    -- ====================================================
    SELECT public.create_dispute_holds(NULL) INTO v_res_count;
    ASSERT v_res_count = 0, 'UJI 1a GAGAL: create_dispute_holds(NULL) wajib return 0';

    SELECT public.create_dispute_holds(pg_catalog.gen_random_uuid()) INTO v_res_count;
    ASSERT v_res_count = 0, 'UJI 1b GAGAL: create_dispute_holds(random_uuid) wajib return 0';

    SELECT public.create_dispute_holds(v_topup_pending_id) INTO v_res_count;
    ASSERT v_res_count = 0, 'UJI 1c GAGAL: create_dispute_holds(pending_order) wajib return 0';

    -- ====================================================
    -- UJI 2: Taint Overlap Window Normal
    -- Plafon = 10 koin * 10000 * 80% = Rp 80.000
    -- Earning 0 (sebelum settled_at): tidak ter-hold
    -- Earning 1 (session, 50.000): ter-hold Rp 50.000 (sisa plafon 30.000)
    -- Earning 2 (extension, 20.000): ter-hold Rp 20.000 (sisa plafon 10.000)
    -- Earning 3 (tip, 30.000): ter-hold Rp 10.000 (plafon tercapai Rp 80.000)
    -- Earning 4 (tip, 20.000): tidak ter-hold karena plafon sudah tercapai
    -- ====================================================
    SELECT public.create_dispute_holds(v_topup_settled_id) INTO v_res_count;
    ASSERT v_res_count = 3, 'UJI 2a GAGAL: create_dispute_holds wajib membuat tepat 3 entri penahanan';

    -- Verifikasi total disputed amount pada tabel
    SELECT COALESCE(pg_catalog.sum(disputed_amount_rupiah), 0)
    INTO v_total_held
    FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id;

    ASSERT v_total_held = 80000, 'UJI 2b GAGAL: Total disputed_amount_rupiah wajib tepat Rp 80.000';

    -- Verifikasi rincian per baris
    SELECT * INTO v_hold_rec
    FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id AND source_type = 'session' AND source_id = v_booking_active_id;
    ASSERT FOUND, 'UJI 2c GAGAL: Hold untuk booking session tidak ditemukan';
    ASSERT v_hold_rec.disputed_amount_rupiah = 50000, 'UJI 2d GAGAL: Nominal hold session harus Rp 50.000';
    ASSERT v_hold_rec.status = 'active', 'UJI 2e GAGAL: Status hold session harus active';

    SELECT * INTO v_hold_rec
    FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id AND source_type = 'extension' AND source_id = v_booking_active_id;
    ASSERT FOUND, 'UJI 2f GAGAL: Hold untuk booking extension tidak ditemukan';
    ASSERT v_hold_rec.disputed_amount_rupiah = 20000, 'UJI 2g GAGAL: Nominal hold extension harus Rp 20.000';
    ASSERT v_hold_rec.status = 'active', 'UJI 2h GAGAL: Status hold extension harus active';

    SELECT * INTO v_hold_rec
    FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id AND source_type = 'tip' AND source_id = v_tip_active_id;
    ASSERT FOUND, 'UJI 2i GAGAL: Hold untuk tip tidak ditemukan';
    ASSERT v_hold_rec.disputed_amount_rupiah = 10000, 'UJI 2j GAGAL: Nominal hold tip harus terpotong plafon menjadi Rp 10.000';
    ASSERT v_hold_rec.status = 'active', 'UJI 2k GAGAL: Status hold tip harus active';

    -- Pastikan booking lama dan tip ekstra tidak masuk hold
    PERFORM 1 FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id AND source_id = v_booking_old_id;
    ASSERT NOT FOUND, 'UJI 2l GAGAL: Earning sebelum settled_at tidak boleh masuk daftar hold';

    PERFORM 1 FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id AND source_id = v_tip_extra_id;
    ASSERT NOT FOUND, 'UJI 2m GAGAL: Earning melampaui plafon tidak boleh masuk daftar hold';

    -- ====================================================
    -- UJI 3: Idempotensi & Retry Safety
    -- ====================================================
    SELECT public.create_dispute_holds(v_topup_settled_id) INTO v_res_count;
    ASSERT v_res_count = 0, 'UJI 3a GAGAL: Eksekusi ulang pada order yang sama wajib return 0';

    SELECT COALESCE(pg_catalog.count(*), 0)
    INTO v_res_count
    FROM public.disputed_payout_holds
    WHERE topup_order_id = v_topup_settled_id;
    ASSERT v_res_count = 3, 'UJI 3b GAGAL: Jumlah entri hold tidak boleh bertambah pada eksekusi ulang';

    -- ====================================================
    -- UJI 4: Penegakan Unique Constraint (topup_order_id, source_type, source_id)
    -- ====================================================
    BEGIN
        INSERT INTO public.disputed_payout_holds (
            topup_order_id, mitra_id, source_type, source_id, disputed_amount_rupiah, status, reason
        ) VALUES (
            v_topup_settled_id, v_psikolog_id, 'session', v_booking_active_id, 10000, 'active', 'Duplikat manual'
        );
    EXCEPTION
        WHEN unique_violation THEN
            v_unique_violation_caught := true;
    END;
    ASSERT v_unique_violation_caught = true, 'UJI 4 GAGAL: Duplikasi (topup_order_id, source_type, source_id) wajib melempar unique_violation';

    -- ====================================================
    -- UJI 5: Verifikasi Hak Akses Katalog (Privileges)
    -- ====================================================
    ASSERT has_function_privilege('public', 'public.create_dispute_holds(uuid)', 'EXECUTE') = false,
        'UJI 5a GAGAL: PUBLIC dilarang memiliki hak EXECUTE pada public.create_dispute_holds';
    ASSERT has_function_privilege('anon', 'public.create_dispute_holds(uuid)', 'EXECUTE') = false,
        'UJI 5b GAGAL: anon dilarang memiliki hak EXECUTE pada public.create_dispute_holds';
    ASSERT has_function_privilege('authenticated', 'public.create_dispute_holds(uuid)', 'EXECUTE') = false,
        'UJI 5c GAGAL: authenticated dilarang memiliki hak EXECUTE pada public.create_dispute_holds';
    ASSERT has_function_privilege('service_role', 'public.create_dispute_holds(uuid)', 'EXECUTE') = true,
        'UJI 5d GAGAL: service_role wajib memiliki hak EXECUTE pada public.create_dispute_holds';

    ASSERT has_table_privilege('anon', 'public.disputed_payout_holds', 'SELECT') = false,
        'UJI 5e GAGAL: anon dilarang memiliki hak SELECT pada disputed_payout_holds';
    ASSERT has_table_privilege('authenticated', 'public.disputed_payout_holds', 'SELECT') = false,
        'UJI 5f GAGAL: authenticated dilarang memiliki hak SELECT pada disputed_payout_holds';
    ASSERT has_table_privilege('service_role', 'public.disputed_payout_holds', 'SELECT') = true,
        'UJI 5g GAGAL: service_role wajib memiliki hak SELECT pada disputed_payout_holds';
    ASSERT has_table_privilege('service_role', 'public.disputed_payout_holds', 'INSERT') = true,
        'UJI 5h GAGAL: service_role wajib memiliki hak INSERT pada disputed_payout_holds';

    -- Akhiri seluruh pengujian sukses dengan melempar penanda DRYRUN_OK
    RAISE EXCEPTION 'DRYRUN_OK';
END $$;

ROLLBACK;
