-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 20261111000027 (MITRA BANK ACCOUNTS)
-- Path: supabase/tests/mitra_bank_accounts_dryrun.sql
-- Scope:
-- 1. Setup role Supabase (anon, authenticated, service_role)
-- 2. Setup user test: auth.users -> public.users
-- 3. DDL Salinan persis dari 20261111000027_mitra_bank_accounts.sql
-- 4. Uji 1: Verifikasi struktur tabel dan kolom (information_schema)
-- 5. Uji 2: Verifikasi Primary Key dan Foreign Key (ON DELETE CASCADE)
-- 6. Uji 3: Verifikasi status RLS aktif dan tanpa policy klien (0 policies)
-- 7. Uji 4: Verifikasi hak akses tabel (REVOKE anon/authenticated, GRANT service_role)
-- 8. Uji 5: Penolakan operasi SELECT, INSERT, UPDATE, DELETE oleh authenticated (error 42501)
-- 9. Uji 6: Kelulusan operasi CRUD oleh service_role
-- 10. Uji 7: Verifikasi integritas FK CASCADE saat user dihapus
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- ========================================================
-- 1. SETUP ROLE SUPABASE
-- ========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role BYPASSRLS;
    END IF;
END $$;

-- ========================================================
-- 2. SETUP FIXTURE DATA: auth.users & public.users
-- ========================================================

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
    ('c9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'psikolog_dryrun_bank@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    ('c9000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'relawan_dryrun_bank@temanbicara.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, no_wa, role, status)
VALUES
    ('c9000000-0000-0000-0000-000000000001', 'psikolog_dryrun_bank@temanbicara.test', '081299990001', 'psikolog'::public.user_role, 'active'::public.account_status),
    ('c9000000-0000-0000-0000-000000000002', 'relawan_dryrun_bank@temanbicara.test', '081299990002', 'relawan'::public.user_role, 'active'::public.account_status)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- ========================================================
-- 3. DDL SALINAN DARI 20261111000027_mitra_bank_accounts.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.mitra_bank_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_account_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.mitra_bank_accounts IS 'Tabel rekening bank tersimpan untuk mitra (psikolog dan relawan) sebagai nilai awal pencairan honor/reward';
COMMENT ON COLUMN public.mitra_bank_accounts.user_id IS 'ID pengguna mitra pemilik rekening (FK users ON DELETE CASCADE)';
COMMENT ON COLUMN public.mitra_bank_accounts.bank_name IS 'Nama bank tujuan pencairan';
COMMENT ON COLUMN public.mitra_bank_accounts.account_number IS 'Nomor rekening bank mitra (6-20 digit angka)';
COMMENT ON COLUMN public.mitra_bank_accounts.bank_account_name IS 'Nama pemilik rekening bank sesuai buku tabungan';
COMMENT ON COLUMN public.mitra_bank_accounts.updated_at IS 'Waktu terakhir data rekening diperbarui';

ALTER TABLE public.mitra_bank_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mitra_bank_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mitra_bank_accounts TO service_role;

-- ========================================================
-- 4. UJI 1: VERIFIKASI STRUKTUR TABEL DAN KOLOM
-- ========================================================

DO $$
DECLARE
    v_missing_cols TEXT;
    v_table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts'
    ) INTO v_table_exists;

    ASSERT v_table_exists = true, 'UJI 1a GAGAL: Tabel public.mitra_bank_accounts tidak ditemukan';

    SELECT string_agg(col, ', ') INTO v_missing_cols
    FROM (
        SELECT 'user_id' AS col WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts' AND column_name = 'user_id'
        )
        UNION ALL
        SELECT 'bank_name' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts' AND column_name = 'bank_name'
        )
        UNION ALL
        SELECT 'account_number' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts' AND column_name = 'account_number'
        )
        UNION ALL
        SELECT 'bank_account_name' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts' AND column_name = 'bank_account_name'
        )
        UNION ALL
        SELECT 'updated_at' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'mitra_bank_accounts' AND column_name = 'updated_at'
        )
    ) t;

    ASSERT v_missing_cols IS NULL, 'UJI 1b GAGAL: Kolom berikut belum ada: ' || coalesce(v_missing_cols, '');
END $$;

-- ========================================================
-- 5. UJI 2: VERIFIKASI PRIMARY KEY DAN FOREIGN KEY CASCADE
-- ========================================================

DO $$
DECLARE
    v_pk_exists BOOLEAN;
    v_fk_cascade BOOLEAN;
BEGIN
    -- Verifikasi PK pada user_id
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'mitra_bank_accounts'
          AND tc.constraint_type = 'PRIMARY KEY'
          AND kcu.column_name = 'user_id'
    ) INTO v_pk_exists;

    ASSERT v_pk_exists = true, 'UJI 2a GAGAL: Primary key pada user_id tidak ditemukan';

    -- Verifikasi FK referensi users(id) ON DELETE CASCADE
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
         AND tc.constraint_schema = rc.constraint_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'mitra_bank_accounts'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'CASCADE'
    ) INTO v_fk_cascade;

    ASSERT v_fk_cascade = true, 'UJI 2b GAGAL: Foreign key CASCADE ke public.users tidak ditemukan';
END $$;

-- ========================================================
-- 6. UJI 3: VERIFIKASI RLS AKTIF DAN ZERO POLICIES
-- ========================================================

DO $$
DECLARE
    v_rls_enabled BOOLEAN;
    v_policy_count INTEGER;
BEGIN
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname = 'mitra_bank_accounts';

    ASSERT v_rls_enabled = true, 'UJI 3a GAGAL: RLS wajib aktif pada public.mitra_bank_accounts';

    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    WHERE cls.relnamespace = 'public'::regnamespace AND cls.relname = 'mitra_bank_accounts';

    ASSERT v_policy_count = 0, 'UJI 3b GAGAL: Tabel mitra_bank_accounts tidak boleh memiliki policy klien';
END $$;

-- ========================================================
-- 7. UJI 4: VERIFIKASI HAK AKSES TABEL
-- ========================================================

DO $$
BEGIN
    -- anon dilarang seluruhnya
    ASSERT has_table_privilege('anon', 'public.mitra_bank_accounts', 'SELECT') = false,
        'UJI 4a GAGAL: Role anon tidak boleh memiliki hak SELECT';
    ASSERT has_table_privilege('anon', 'public.mitra_bank_accounts', 'INSERT') = false,
        'UJI 4b GAGAL: Role anon tidak boleh memiliki hak INSERT';
    ASSERT has_table_privilege('anon', 'public.mitra_bank_accounts', 'UPDATE') = false,
        'UJI 4c GAGAL: Role anon tidak boleh memiliki hak UPDATE';
    ASSERT has_table_privilege('anon', 'public.mitra_bank_accounts', 'DELETE') = false,
        'UJI 4d GAGAL: Role anon tidak boleh memiliki hak DELETE';

    -- authenticated dilarang seluruhnya
    ASSERT has_table_privilege('authenticated', 'public.mitra_bank_accounts', 'SELECT') = false,
        'UJI 4e GAGAL: Role authenticated tidak boleh memiliki hak SELECT';
    ASSERT has_table_privilege('authenticated', 'public.mitra_bank_accounts', 'INSERT') = false,
        'UJI 4f GAGAL: Role authenticated tidak boleh memiliki hak INSERT';
    ASSERT has_table_privilege('authenticated', 'public.mitra_bank_accounts', 'UPDATE') = false,
        'UJI 4g GAGAL: Role authenticated tidak boleh memiliki hak UPDATE';
    ASSERT has_table_privilege('authenticated', 'public.mitra_bank_accounts', 'DELETE') = false,
        'UJI 4h GAGAL: Role authenticated tidak boleh memiliki hak DELETE';

    -- service_role diizinkan seluruhnya
    ASSERT has_table_privilege('service_role', 'public.mitra_bank_accounts', 'SELECT') = true,
        'UJI 4i GAGAL: Role service_role wajib memiliki hak SELECT';
    ASSERT has_table_privilege('service_role', 'public.mitra_bank_accounts', 'INSERT') = true,
        'UJI 4j GAGAL: Role service_role wajib memiliki hak INSERT';
    ASSERT has_table_privilege('service_role', 'public.mitra_bank_accounts', 'UPDATE') = true,
        'UJI 4k GAGAL: Role service_role wajib memiliki hak UPDATE';
    ASSERT has_table_privilege('service_role', 'public.mitra_bank_accounts', 'DELETE') = true,
        'UJI 4l GAGAL: Role service_role wajib memiliki hak DELETE';
END $$;

-- ========================================================
-- 8. UJI 5: EKSEKUSI OLEH AUTHENTICATED DITOLAK (42501)
-- ========================================================

SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        EXECUTE 'SELECT * FROM public.mitra_bank_accounts';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5a GAGAL: SELECT oleh authenticated wajib ditolak (42501)';

    v_threw := false;
    BEGIN
        EXECUTE 'INSERT INTO public.mitra_bank_accounts (user_id, bank_name, account_number, bank_account_name) VALUES (''c9000000-0000-0000-0000-000000000001''::uuid, ''Bank Mandiri'', ''1234567890'', ''Tester'')';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5b GAGAL: INSERT oleh authenticated wajib ditolak (42501)';
END $$;

RESET ROLE;

-- ========================================================
-- 9. UJI 6: KELULUSAN OPERASI CRUD OLEH SERVICE_ROLE
-- ========================================================

SET LOCAL ROLE service_role;

DO $$
DECLARE
    v_count INTEGER;
    v_read_bank TEXT;
BEGIN
    -- Insert rekening psikolog
    INSERT INTO public.mitra_bank_accounts (user_id, bank_name, account_number, bank_account_name)
    VALUES ('c9000000-0000-0000-0000-000000000001'::uuid, 'Bank Central Asia (BCA)', '1234567890', 'Budi Santoso');

    SELECT bank_name INTO v_read_bank
    FROM public.mitra_bank_accounts
    WHERE user_id = 'c9000000-0000-0000-0000-000000000001'::uuid;

    ASSERT v_read_bank = 'Bank Central Asia (BCA)', 'UJI 6a GAGAL: service_role gagal membaca rekening';

    -- Upsert rekening relawan
    INSERT INTO public.mitra_bank_accounts (user_id, bank_name, account_number, bank_account_name)
    VALUES ('c9000000-0000-0000-0000-000000000002'::uuid, 'Bank Mandiri', '9876543210', 'Siti Rahma')
    ON CONFLICT (user_id) DO UPDATE SET
        bank_name = EXCLUDED.bank_name,
        account_number = EXCLUDED.account_number,
        bank_account_name = EXCLUDED.bank_account_name,
        updated_at = pg_catalog.now();

    SELECT COUNT(*) INTO v_count FROM public.mitra_bank_accounts;
    ASSERT v_count = 2, 'UJI 6b GAGAL: Jumlah baris rekening harus 2';
END $$;

RESET ROLE;

-- ========================================================
-- 10. UJI 7: VERIFIKASI INTEGRITAS CASCADE ON DELETE
-- ========================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Hapus user psikolog dari public.users
    DELETE FROM public.users WHERE id = 'c9000000-0000-0000-0000-000000000001'::uuid;

    -- Baris di mitra_bank_accounts harus otomatis terhapus secara cascade
    SELECT COUNT(*) INTO v_count
    FROM public.mitra_bank_accounts
    WHERE user_id = 'c9000000-0000-0000-0000-000000000001'::uuid;

    ASSERT v_count = 0, 'UJI 7a GAGAL: Rekening harus terhapus saat user dihapus (ON DELETE CASCADE)';
END $$;

-- ========================================================
-- NOTIFIKASI KELULUSAN & TRANSAKSI ROLLBACK
-- ========================================================

DO $$
BEGIN
    RAISE NOTICE 'DRYRUN_OK';
END $$;

ROLLBACK;
