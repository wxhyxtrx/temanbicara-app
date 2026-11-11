-- ========================================================
-- TEMAN BICARA: ENFORCEMENT ADMIN AKTIF PADA HELPER RLS IS_ADMIN (PRD-046 / T-194)
-- Migration: 20261111000029_active_admin_only.sql
-- ========================================================

-- Redefinisi public.is_admin():
-- Mensyaratkan pemanggil memiliki role = 'admin' DAN status = 'active'
-- pada tabel public.users agar akun admin yang ditangguhkan atau nonaktif
-- tidak lagi lolos evaluasi RLS maupun fungsi yang bergantung pada public.is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND role = 'admin'::public.user_role
          AND status = 'active'::public.account_status
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_admin() IS 'Helper RLS non-rekursif untuk verifikasi apakah pemanggil memiliki role admin dengan status akun active';
