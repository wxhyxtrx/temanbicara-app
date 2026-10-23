-- ========================================================
-- TEMAN BICARA: PENGERASAN IZIN DATABASE & PROTEKSI KOLOM ANONIM (PRD-019)
-- Migration: 20261022000026_database_permissions_hardening.sql
-- ========================================================

-- 1. PENCABUTAN MENYELURUH HAK TULIS & TRUNCATE
-- Role anon dan authenticated dilarang keras melakukan operasi mutasi langsung
-- (INSERT, UPDATE, DELETE, TRUNCATE) pada seluruh tabel di skema public melalui PostgREST.
-- Hak SELECT untuk RLS dan Supabase Realtime tetap dipertahankan.
-- Seluruh mutasi tulis wajib 100% melalui API server / RPC via service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. PENCABUTAN EKSEKUSI KHUSUS FUNGSI TRIGGER (SECURITY DEFINER)
-- Fungsi trigger berstatus SECURITY DEFINER tidak boleh dapat dieksekusi secara manual via RPC
-- oleh PUBLIC, anon, maupun authenticated.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS func_name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prorettype = 'trigger'::regtype
          AND p.prosecdef = true
    LOOP
        EXECUTE 'REVOKE ALL ON FUNCTION ' || r.func_name || ' FROM PUBLIC, anon, authenticated;';
    END LOOP;
END $$;

-- 3. PROTEKSI KOLOM patient_id PADA public.peer_tickets
-- Cabut hak SELECT tabel penuh dari authenticated dan anon
REVOKE SELECT ON public.peer_tickets FROM authenticated, anon;

-- Berikan GRANT SELECT hanya pada kolom non-sensitif ke authenticated
-- Kolom patient_id tertutup rapat dari PostgREST klien untuk melindungi anonimitas pasien
GRANT SELECT (
    id,
    patient_alias,
    topic,
    emotion,
    content,
    is_anonymous,
    status,
    claimed_by,
    claimed_at,
    first_response_at,
    closed_at,
    closed_by,
    archived_at,
    abandoned_by,
    created_at,
    updated_at
) ON public.peer_tickets TO authenticated;

-- 4. ALTER DEFAULT PRIVILEGES EKSPLISIT PER PEMILIK (postgres & supabase_admin)
-- Mengunci pembuatan tabel, fungsi, dan sequence di masa mendatang pada skema public
-- agar tidak kembali terbuka secara otomatis untuk anon dan authenticated

-- Untuk role postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Untuk role supabase_admin
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 5. JARING PENGAMAN service_role
-- Menjamin seluruh operasi backend API, admin, cron, dan migrasi tetap memiliki hak akses penuh
-- tanpa mengganggu supabase_auth_admin (skema auth) dan supabase_storage_admin (skema storage)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
