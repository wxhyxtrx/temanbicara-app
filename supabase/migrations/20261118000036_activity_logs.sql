-- ========================================================
-- TEMAN BICARA: LOG AKTIVITAS SELURUH PENGGUNA (PRD-055)
-- Migration: 20261118000036_activity_logs.sql
-- Append-only: tidak ada UPDATE/DELETE (trigger + hak akses). Tanpa PII
-- (tanpa email, password, nomor rekening); aktor & target dirujuk lewat ID.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    -- Tanpa FOREIGN KEY: log tetap ada walau pengguna dihapus.
    actor_id UUID,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('pasien', 'psikolog', 'relawan', 'admin', 'system', 'guest')),
    category TEXT NOT NULL CHECK (category IN ('auth', 'admin', 'money')),
    action TEXT NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$' AND pg_catalog.length(action) <= 64),
    target_type TEXT CHECK (target_type IS NULL OR pg_catalog.length(target_type) <= 40),
    target_id TEXT CHECK (target_id IS NULL OR pg_catalog.length(target_id) <= 80),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (pg_catalog.jsonb_typeof(metadata) = 'object' AND pg_catalog.pg_column_size(metadata) <= 2048)
);

COMMENT ON TABLE public.activity_logs IS 'Log aktivitas append-only seluruh pengguna (auth, aksi admin, transaksi uang). Tanpa PII.';

CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_category_created_idx ON public.activity_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_actor_created_idx ON public.activity_logs (actor_id, created_at DESC);

-- Tolak UPDATE/DELETE untuk siapa pun (termasuk service_role).
CREATE OR REPLACE FUNCTION public.reject_activity_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'ACTIVITY_LOG_IMMUTABLE' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS activity_logs_immutable ON public.activity_logs;
CREATE TRIGGER activity_logs_immutable
BEFORE UPDATE OR DELETE ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.reject_activity_log_mutation();

REVOKE ALL ON FUNCTION public.reject_activity_log_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- RLS tanpa policy: hanya server (service_role) yang bisa mengakses, dan hanya SELECT + INSERT.
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.activity_logs TO service_role;
