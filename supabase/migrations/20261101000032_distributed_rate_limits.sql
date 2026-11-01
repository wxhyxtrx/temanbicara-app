-- ========================================================
-- TEMAN BICARA: DISTRIBUTED RATE LIMITING (PRD-032)
-- Migration: 20261101000032_distributed_rate_limits.sql
-- ========================================================

-- 1. TABEL PUBLIC.RATE_LIMITS
-- Tabel terdistribusi penyimpan hitungan percobaan permintaan (rate limit)
-- berdasarkan identifier unik (hash IP / hash email).
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index pada expires_at untuk efisiensi pembersihan baris kadaluarsa
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits (expires_at);

-- Keamanan RLS & Hak Akses Tabel
-- Tabel rate limits hanya boleh diakses oleh service_role backend.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- 2. RPC ATOMIK RATE LIMIT INCREMENT
-- Fungsi RPC atomik untuk memeriksa dan menambah hitungan rate limit.
-- Parameter:
--   p_key: identifier unik (mis. hash IP / hash email)
--   p_limit: batas maksimal percobaan dalam jendela waktu
--   p_window_seconds: durasi jendela waktu dalam detik
-- Mengembalikan JSONB:
--   { allowed: boolean, count: number, remaining: number, retry_after: number }
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

-- Hak Eksekusi Fungsi RPC
REVOKE ALL ON FUNCTION public.rate_limit_increment(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON TABLE public.rate_limits IS 'Tabel penyimpanan hitungan rate limiting terdistribusi berbasis IP dan email hash';
COMMENT ON FUNCTION public.rate_limit_increment(TEXT, INTEGER, INTEGER) IS 'RPC atomik untuk increment counter rate limit dan pembersihan otomatis baris kadaluarsa';
