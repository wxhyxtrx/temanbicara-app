-- T-199 / PRD-047: batasi kolom profil dan seragamkan cek admin aktif.
-- Tidak mengubah grant service_role maupun klausa akses non-admin.
REVOKE SELECT ON public.psikolog_profiles, public.relawan_profiles FROM anon;
REVOKE SELECT ON public.psikolog_profiles FROM authenticated;
-- Bersihkan juga grant kolom sensitif lama; grant tabel saja tidak cukup.
REVOKE SELECT (dokumen_sipp_str_url, nomor_sipp_str, saldo, rejection_reason, suspended_until)
    ON public.psikolog_profiles FROM authenticated;
GRANT SELECT (
    user_id, nama_lengkap_gelar, spesialisasi, tahun_pengalaman, tarif_sesi,
    verified_at, created_at, updated_at, booking_paused, extension_price_coins
) ON public.psikolog_profiles TO authenticated;

DROP POLICY IF EXISTS "Public read approved psikolog" ON public.psikolog_profiles;
CREATE POLICY "Public read approved psikolog"
ON public.psikolog_profiles FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = user_id AND users.status = 'active')
    OR auth.uid() = user_id
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admin manage relawan" ON public.relawan_profiles;
CREATE POLICY "Admin manage relawan"
ON public.relawan_profiles FOR ALL
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only read system_settings" ON public.system_settings;
CREATE POLICY "Admin only read system_settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin only read system_settings_audit" ON public.system_settings_audit;
CREATE POLICY "Admin only read system_settings_audit"
ON public.system_settings_audit FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Mitra and admin view docs" ON storage.objects;
CREATE POLICY "Mitra and admin view docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'dokumen-mitra' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    )
);
