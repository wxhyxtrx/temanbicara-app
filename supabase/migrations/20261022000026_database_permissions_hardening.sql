-- ========================================================
-- TEMAN BICARA: PENGERASAN IZIN DATABASE & PROTEKSI KOLOM ANONIM (PRD-019 & PRD-020)
-- Migration: 20261022000026_database_permissions_hardening.sql
-- Urutan Eksekusi Atomik:
-- 1. Pemeriksaan & Penguatan Fungsi public.is_admin() (SECURITY DEFINER)
-- 2. Helper Kepesertaan Tiket public.is_peer_ticket_participant (SECURITY DEFINER)
-- 3. Pembaruan Policy RLS peer_messages_select_participant memanggil helper
-- 4. Pencabutan SELECT Penuh & Proteksi Kolom patient_id pada public.peer_tickets (16 kolom)
-- 5. Pencabutan Menyeluruh Hak Tulis & Truncate Semua Tabel Public dari anon & authenticated
-- 6. Pencabutan Eksekusi Khusus Fungsi Trigger (Security Definer) via Loop PL/pgSQL
-- 7. ALTER DEFAULT PRIVILEGES Eksplisit per Pemilik (postgres & supabase_admin)
-- 8. Jaring Pengaman Hak Akses service_role
-- ========================================================

-- 1. PEMERIKSAAN & PENGUATAN FUNGSI public.is_admin()
-- Memastikan helper pemeriksaan peran admin berstatus SECURITY DEFINER dengan search_path aman
-- dan hak eksekusi terkelola rapi (REVOKE dari PUBLIC/anon, GRANT ke authenticated & service_role).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'::public.user_role
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 2. HELPER KEPESERTAAN TIKET public.is_peer_ticket_participant(p_ticket_id UUID)
-- Fungsi SECURITY DEFINER yang mengevaluasi kepesertaan pasien (patient_id = auth.uid())
-- atau relawan (claimed_by = auth.uid()) dengan hak internal yang aman.
-- Mencegah error 42501 permission denied saat RLS peer_messages dievaluasi oleh role authenticated.
CREATE OR REPLACE FUNCTION public.is_peer_ticket_participant(p_ticket_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.peer_tickets
        WHERE id = p_ticket_id
          AND (patient_id = auth.uid() OR claimed_by = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_peer_ticket_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_peer_ticket_participant(UUID) TO authenticated, service_role;

-- 3. PEMBARUAN POLICY RLS peer_messages_select_participant
-- Menggantikan policy subquery langsung pada peer_messages agar memanggil helper fungsi
-- public.is_peer_ticket_participant(ticket_id) atau public.is_admin().
DROP POLICY IF EXISTS peer_messages_select_participant ON public.peer_messages;
CREATE POLICY peer_messages_select_participant ON public.peer_messages
    FOR SELECT TO authenticated
    USING (
        public.is_peer_ticket_participant(ticket_id)
        OR public.is_admin()
    );

-- 4. PROTEKSI KOLOM patient_id PADA public.peer_tickets
-- Cabut hak SELECT tabel penuh dari authenticated dan anon.
-- Berikan GRANT SELECT hanya pada 16 kolom non-sensitif ke authenticated.
-- Kolom patient_id tertutup rapat dari PostgREST klien untuk melindungi anonimitas pasien.
REVOKE SELECT ON public.peer_tickets FROM authenticated, anon;

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

-- 5. PENCABUTAN MENYELURUH HAK TULIS & TRUNCATE
-- Role anon dan authenticated dilarang keras melakukan operasi mutasi langsung
-- (INSERT, UPDATE, DELETE, TRUNCATE) pada seluruh tabel di skema public melalui PostgREST.
-- Hak SELECT untuk RLS dan Supabase Realtime tetap dipertahankan.
-- Seluruh mutasi tulis wajib 100% melalui API server / RPC via service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 6. PENCABUTAN EKSEKUSI KHUSUS FUNGSI TRIGGER (SECURITY DEFINER)
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

-- 7. ALTER DEFAULT PRIVILEGES EKSPLISIT PER PEMILIK (postgres & supabase_admin)
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

-- 8. JARING PENGAMAN service_role
-- Menjamin seluruh operasi backend API, admin, cron, dan migrasi tetap memiliki hak akses penuh
-- tanpa mengganggu supabase_auth_admin (skema auth) dan supabase_storage_admin (skema storage)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
