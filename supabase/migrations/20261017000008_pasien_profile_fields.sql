-- ========================================================
-- TEMAN BICARA: PASIEN PROFILE FIELDS (MIGRATION 000008)
-- Eksekusi file ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Scope:
-- 1. Tambah kolom pasien_profiles:
--    - nama_panggilan TEXT
--    - kontak_darurat_nama TEXT
--    - kontak_darurat_wa TEXT
--    - is_anonim_default BOOLEAN NOT NULL DEFAULT false
-- ========================================================

-- 1. ALTER TABLE pasien_profiles
ALTER TABLE public.pasien_profiles
    ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
    ADD COLUMN IF NOT EXISTS kontak_darurat_nama TEXT,
    ADD COLUMN IF NOT EXISTS kontak_darurat_wa TEXT,
    ADD COLUMN IF NOT EXISTS is_anonim_default BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pasien_profiles.nama_panggilan IS 'Nama panggilan atau nama samaran (alias) pasien untuk sesi konseling';
COMMENT ON COLUMN public.pasien_profiles.kontak_darurat_nama IS 'Nama kontak darurat pasien untuk protokol keselamatan/krisis klinis';
COMMENT ON COLUMN public.pasien_profiles.kontak_darurat_wa IS 'Nomor WhatsApp kontak darurat pasien';
COMMENT ON COLUMN public.pasien_profiles.is_anonim_default IS 'Preferensi default pasien untuk menyembunyikan identitas asli saat konseling';
