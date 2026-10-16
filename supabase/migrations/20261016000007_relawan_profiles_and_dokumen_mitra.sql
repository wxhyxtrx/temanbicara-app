-- ========================================================
-- TEMAN BICARA: FIX RELAWAN PROFILES & DOKUMEN MITRA (MIGRATION 000007)
-- Eksekusi file ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Scope:
-- 1. Tambah kolom relawan_profiles: alias_name, is_available, topik_keahlian, rating_rata_rata
-- ========================================================

-- 1. ALTER TABLE relawan_profiles
ALTER TABLE public.relawan_profiles
    ADD COLUMN IF NOT EXISTS alias_name TEXT,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS topik_keahlian TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS rating_rata_rata NUMERIC(3, 2);

COMMENT ON COLUMN public.relawan_profiles.alias_name IS 'Nama samaran publik relawan untuk menjaga anonimitas';
COMMENT ON COLUMN public.relawan_profiles.is_available IS 'Status ketersediaan relawan untuk menerima sesi konsultasi';
COMMENT ON COLUMN public.relawan_profiles.topik_keahlian IS 'Daftar topik curhat / keahlian yang dapat ditangani relawan';
COMMENT ON COLUMN public.relawan_profiles.rating_rata_rata IS 'Rata-rata rating relawan (maksimal 5.00)';
