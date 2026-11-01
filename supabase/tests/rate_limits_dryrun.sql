-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000032 (DISTRIBUTED RATE LIMITS)
-- Path: supabase/tests/rate_limits_dryrun.sql
-- Scope:
-- 1. Setup role & simulasi privasi Supabase (anon, authenticated, service_role)
-- 2. DDL Salinan persis dari 20261101000032_distributed_rate_limits.sql
-- 3. Assert Uji 1: Pemanggilan pertama menghasilkan allowed = true, count = 1, remaining = limit - 1, retry_after = 0
-- 4. Assert Uji 2: Pemanggilan berturut-turut hingga melewati ambang batas limit menghasilkan allowed = false, remaining = 0, retry_after > 0
-- 5. Assert Uji 3: Pembersihan otomatis baris kadaluarsa (expires_at < clock_timestamp())
-- 6. Assert Uji 4: Reset counter dan jendela waktu pada kunci yang telah kadaluarsa
-- 7. Assert Uji 5: Penolakan akses tabel rate_limits (SELECT, INSERT, UPDATE, DELETE) oleh authenticated (error 42501)
-- 8. Assert Uji 6: Penolakan eksekusi RPC rate_limit_increment oleh authenticated (error 42501)
-- 9. Assert Uji 7: Kelulusan pemanggilan RPC dan akses tabel oleh service_role
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
-- 2. DDL MIGRATION 20261101000032_distributed_rate_limits.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits (expires_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_increment(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_expires_at TIMESTAMPTZ;
    v_count INTEGER;
    v_allowed BOOLEAN;
    v_remaining INTEGER;
    v_retry_after INTEGER := 0;
BEGIN
    -- Pembersihan otomatis baris kadaluarsa
    DELETE FROM public.rate_limits WHERE expires_at < v_now;

    -- Upsert hitungan secara atomik
    INSERT INTO public.rate_limits (key, count, expires_at, created_at)
    VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval, v_now)
    ON CONFLICT (key) DO UPDATE
    SET count = CASE
            WHEN public.rate_limits.expires_at < v_now THEN 1
            ELSE public.rate_limits.count + 1
        END,
        expires_at = CASE
            WHEN public.rate_limits.expires_at < v_now THEN v_now + (p_window_seconds || ' seconds')::interval
            ELSE public.rate_limits.expires_at
        END
    RETURNING count, expires_at INTO v_count, v_expires_at;

    IF v_count <= p_limit THEN
        v_allowed := true;
        v_remaining := p_limit - v_count;
        v_retry_after := 0;
    ELSE
        v_allowed := false;
        v_remaining := 0;
        v_retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::INTEGER);
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'count', v_count,
        'remaining', v_remaining,
        'retry_after', v_retry_after
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_increment(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(TEXT, INTEGER, INTEGER) TO service_role;

-- ========================================================
-- 3. SUITE PENGUJIAN SKENARIO & ASSERTIONS
-- ========================================================

-- --------------------------------------------------------
-- UJI 1: Pemanggilan pertama rate_limit_increment
-- --------------------------------------------------------
DO $$
DECLARE
    v_res JSONB;
BEGIN
    v_res := public.rate_limit_increment('test_key:first_call', 5, 900);

    ASSERT (v_res->>'allowed')::BOOLEAN = true, 'UJI 1a GAGAL: allowed wajib bernilai true pada pemanggilan pertama';
    ASSERT (v_res->>'count')::INTEGER = 1, 'UJI 1b GAGAL: count wajib bernilai 1 pada pemanggilan pertama';
    ASSERT (v_res->>'remaining')::INTEGER = 4, 'UJI 1c GAGAL: remaining wajib bernilai 4 (limit 5 - count 1)';
    ASSERT (v_res->>'retry_after')::INTEGER = 0, 'UJI 1d GAGAL: retry_after wajib 0 saat belum melewati limit';
END $$;

-- --------------------------------------------------------
-- UJI 2: Pemanggilan berturut-turut hingga melewati batas limit
-- --------------------------------------------------------
DO $$
DECLARE
    v_res JSONB;
    v_step INTEGER;
BEGIN
    -- Uji kenaikan count 1 hingga 5
    FOR v_step IN 1..5 LOOP
        v_res := public.rate_limit_increment('test_key:threshold_check', 5, 900);
        ASSERT (v_res->>'allowed')::BOOLEAN = true, format('UJI 2 GAGAL: Pemanggilan ke-%s harusnya allowed=true', v_step);
        ASSERT (v_res->>'count')::INTEGER = v_step, format('UJI 2 GAGAL: Count pemanggilan ke-%s harusnya %s', v_step, v_step);
        ASSERT (v_res->>'remaining')::INTEGER = (5 - v_step), format('UJI 2 GAGAL: Remaining pemanggilan ke-%s harusnya %s', v_step, 5 - v_step);
        ASSERT (v_res->>'retry_after')::INTEGER = 0, format('UJI 2 GAGAL: Retry_after pemanggilan ke-%s harusnya 0', v_step);
    END LOOP;

    -- Pemanggilan ke-6: ambang batas terlampaui
    v_res := public.rate_limit_increment('test_key:threshold_check', 5, 900);
    ASSERT (v_res->>'allowed')::BOOLEAN = false, 'UJI 2 GAGAL: Pemanggilan ke-6 wajib allowed=false (terblokir)';
    ASSERT (v_res->>'count')::INTEGER = 6, 'UJI 2 GAGAL: Count pemanggilan ke-6 harusnya 6';
    ASSERT (v_res->>'remaining')::INTEGER = 0, 'UJI 2 GAGAL: Remaining saat terblokir wajib 0';
    ASSERT (v_res->>'retry_after')::INTEGER > 0, 'UJI 2 GAGAL: Retry_after saat terblokir wajib > 0';
    ASSERT (v_res->>'retry_after')::INTEGER <= 900, 'UJI 2 GAGAL: Retry_after tidak boleh melebihi window_seconds (900)';
END $$;

-- --------------------------------------------------------
-- UJI 3: Pembersihan otomatis baris kadaluarsa (expires_at < clock_timestamp())
-- --------------------------------------------------------
DO $$
DECLARE
    v_res JSONB;
    v_count INTEGER;
BEGIN
    -- Sisipkan fixture baris yang sudah kadaluarsa secara manual
    INSERT INTO public.rate_limits (key, count, expires_at, created_at)
    VALUES (
        'test_key:stale_entry',
        10,
        clock_timestamp() - interval '30 seconds',
        clock_timestamp() - interval '120 seconds'
    );

    -- Pastikan baris tersimpan
    SELECT COUNT(*) INTO v_count FROM public.rate_limits WHERE key = 'test_key:stale_entry';
    ASSERT v_count = 1, 'UJI 3a GAGAL: Fixture baris kadaluarsa gagal disisipkan';

    -- Panggil rate_limit_increment untuk kunci lain
    v_res := public.rate_limit_increment('test_key:other_fresh', 5, 60);

    -- Verifikasi bahwa baris kadaluarsa telah dibersihkan otomatis
    SELECT COUNT(*) INTO v_count FROM public.rate_limits WHERE key = 'test_key:stale_entry';
    ASSERT v_count = 0, 'UJI 3b GAGAL: Baris kadaluarsa wajib dibersihkan otomatis saat RPC berjalan';
END $$;

-- --------------------------------------------------------
-- UJI 4: Reset counter pada kunci yang telah kadaluarsa
-- --------------------------------------------------------
DO $$
DECLARE
    v_res JSONB;
BEGIN
    -- Sisipkan baris dengan kunci yang sama tetapi expires_at sudah lewat
    INSERT INTO public.rate_limits (key, count, expires_at, created_at)
    VALUES (
        'test_key:reusable_after_expiry',
        5,
        clock_timestamp() - interval '5 seconds',
        clock_timestamp() - interval '60 seconds'
    );

    -- Panggil rate_limit_increment untuk kunci tersebut
    v_res := public.rate_limit_increment('test_key:reusable_after_expiry', 5, 60);

    -- Counter harus di-reset kembali ke 1 dan status allowed = true
    ASSERT (v_res->>'allowed')::BOOLEAN = true, 'UJI 4a GAGAL: Kunci kadaluarsa wajib di-reset menjadi allowed=true';
    ASSERT (v_res->>'count')::INTEGER = 1, 'UJI 4b GAGAL: Kunci kadaluarsa wajib me-reset count menjadi 1';
    ASSERT (v_res->>'remaining')::INTEGER = 4, 'UJI 4c GAGAL: Kunci kadaluarsa wajib me-reset remaining menjadi 4';
    ASSERT (v_res->>'retry_after')::INTEGER = 0, 'UJI 4d GAGAL: Retry_after wajib 0 setelah kunci di-reset';
END $$;

-- --------------------------------------------------------
-- UJI 5: Penolakan akses tabel public.rate_limits oleh role authenticated (error 42501)
-- --------------------------------------------------------

-- 5a: Verifikasi hak istimewa tabel via has_table_privilege
DO $$
BEGIN
    ASSERT has_table_privilege('authenticated', 'public.rate_limits', 'SELECT') = false,
        'UJI 5a GAGAL: Role authenticated tidak boleh memiliki hak SELECT pada rate_limits';
    ASSERT has_table_privilege('authenticated', 'public.rate_limits', 'INSERT') = false,
        'UJI 5b GAGAL: Role authenticated tidak boleh memiliki hak INSERT pada rate_limits';
    ASSERT has_table_privilege('authenticated', 'public.rate_limits', 'UPDATE') = false,
        'UJI 5c GAGAL: Role authenticated tidak boleh memiliki hak UPDATE pada rate_limits';
    ASSERT has_table_privilege('authenticated', 'public.rate_limits', 'DELETE') = false,
        'UJI 5d GAGAL: Role authenticated tidak boleh memiliki hak DELETE pada rate_limits';
END $$;

-- 5b: Eksekusi langsung SELECT rate_limits oleh authenticated wajib melempar 42501
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM * FROM public.rate_limits;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5e GAGAL: SELECT rate_limits oleh authenticated wajib ditolak (42501)';
END $$;
RESET ROLE;

-- 5c: Eksekusi langsung INSERT rate_limits oleh authenticated wajib melempar 42501
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.rate_limits (key, count, expires_at, created_at)
        VALUES ('tamper:key', 1, clock_timestamp() + interval '60 seconds', clock_timestamp());
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 5f GAGAL: INSERT rate_limits oleh authenticated wajib ditolak (42501)';
END $$;
RESET ROLE;

-- --------------------------------------------------------
-- UJI 6: Penolakan eksekusi RPC rate_limit_increment oleh role authenticated (error 42501)
-- --------------------------------------------------------

-- 6a: Verifikasi hak eksekusi via has_function_privilege
DO $$
BEGIN
    ASSERT has_function_privilege('authenticated', 'public.rate_limit_increment(text, integer, integer)', 'EXECUTE') = false,
        'UJI 6a GAGAL: Role authenticated tidak boleh memiliki hak EXECUTE pada rate_limit_increment';
END $$;

-- 6b: Eksekusi langsung RPC rate_limit_increment oleh authenticated wajib melempar 42501
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_threw BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM public.rate_limit_increment('test_key:authenticated_blocked', 5, 60);
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_threw := true;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN v_threw := true; END IF;
    END;
    ASSERT v_threw = true, 'UJI 6b GAGAL: Eksekusi rate_limit_increment oleh authenticated wajib ditolak (42501)';
END $$;
RESET ROLE;

-- --------------------------------------------------------
-- UJI 7: Kelulusan eksekusi RPC dan pembacaan tabel oleh role service_role
-- --------------------------------------------------------

-- 7a: Verifikasi hak istimewa service_role via has_function_privilege & has_table_privilege
DO $$
BEGIN
    ASSERT has_function_privilege('service_role', 'public.rate_limit_increment(text, integer, integer)', 'EXECUTE') = true,
        'UJI 7a GAGAL: Role service_role wajib memiliki hak EXECUTE pada rate_limit_increment';
    ASSERT has_table_privilege('service_role', 'public.rate_limits', 'SELECT') = true,
        'UJI 7b GAGAL: Role service_role wajib memiliki hak SELECT pada rate_limits';
END $$;

-- 7b: Eksekusi RPC dan query tabel oleh role service_role
SET LOCAL ROLE service_role;
DO $$
DECLARE
    v_res JSONB;
    v_count INTEGER;
BEGIN
    v_res := public.rate_limit_increment('test_key:service_role_success', 3, 30);
    ASSERT (v_res->>'allowed')::BOOLEAN = true, 'UJI 7c GAGAL: service_role wajib berhasil mengeksekusi RPC rate_limit_increment';
    ASSERT (v_res->>'count')::INTEGER = 1, 'UJI 7d GAGAL: service_role count wajib bernilai 1';

    SELECT COUNT(*) INTO v_count FROM public.rate_limits WHERE key = 'test_key:service_role_success';
    ASSERT v_count = 1, 'UJI 7e GAGAL: service_role wajib dapat membaca tabel rate_limits';
END $$;
RESET ROLE;

-- ========================================================
-- NOTIFIKASI KELULUSAN & TRANSAKSI ROLLBACK
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN DISTRIBUTED RATE LIMITS LULUS 100%%.';
END $$;

ROLLBACK;
