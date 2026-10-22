-- ========================================================
-- TEMAN BICARA: PENCABUTAN HAK MUTASI K1 & T2, PENYESUAIAN RLS (PRD-015)
-- Migration: 20261022000023_security_revocations_k1_t2.sql
-- ========================================================

-- 1. PENCABUTAN IZIN MUTASI & TRUNCATE (POSTGRES PERMISSIONS)
-- Role anon dan authenticated dilarang keras melakukan operasi mutasi langsung
-- (INSERT, UPDATE, DELETE, TRUNCATE) melalui PostgREST pada 4 tabel sensitif:
-- - public.psikolog_profiles (Celah K1: manipulasi suspensi, tarif, dsb)
-- - public.pasien_profiles   (Celah K1: bypass validasi sanitasi kontak darurat)
-- - public.peer_messages     (Celah T2: bypass validasi sapaan & jendela 24 jam)
-- - public.session_messages  (Celah T2: bypass validasi sesi konseling & voice note)

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.psikolog_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pasien_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.peer_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.session_messages FROM anon, authenticated;

-- Hak SELECT tetap dipertahankan untuk query baca dan Supabase Realtime
GRANT SELECT ON public.psikolog_profiles TO anon, authenticated;
GRANT SELECT ON public.pasien_profiles TO authenticated;
GRANT SELECT ON public.peer_messages TO authenticated;
GRANT SELECT ON public.session_messages TO authenticated;

-- Hak penuh mutasi dan administrasi data diberikan kepada service_role
GRANT ALL ON public.psikolog_profiles TO service_role;
GRANT ALL ON public.pasien_profiles TO service_role;
GRANT ALL ON public.peer_messages TO service_role;
GRANT ALL ON public.session_messages TO service_role;

-- 2. PENYELARASAN & PEMBERSIHAN POLICY RLS YANG USANG

-- a. peer_messages: hapus policy INSERT participant karena penulisan langsung dicabut
DROP POLICY IF EXISTS peer_messages_insert_participant ON public.peer_messages;

-- b. session_messages: pastikan policy INSERT usang dibersihkan
DROP POLICY IF EXISTS session_messages_insert_service_only ON public.session_messages;

-- c. psikolog_profiles: hapus policy UPDATE non-financial yang memicu celah K1
DROP POLICY IF EXISTS "Psikolog update own profile non-financial" ON public.psikolog_profiles;

-- d. pasien_profiles: cabut policy ALL lama ("Pasien can manage own profile"),
-- ganti dengan policy SELECT saja ("Pasien can view own profile")
DROP POLICY IF EXISTS "Pasien can manage own profile" ON public.pasien_profiles;
DROP POLICY IF EXISTS "Pasien can view own profile" ON public.pasien_profiles;
CREATE POLICY "Pasien can view own profile" ON public.pasien_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());
