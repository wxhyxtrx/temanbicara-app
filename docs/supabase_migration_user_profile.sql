-- Kolom profil tambahan untuk endpoint GET /api/users/me, /api/volunteers.
-- Endpoint tetap jalan sebelum migration ini (kolom yang belum ada dikembalikan null/default).
ALTER TABLE public.pasien_profiles
    ADD COLUMN IF NOT EXISTS kontak_darurat_nama VARCHAR(255),
    ADD COLUMN IF NOT EXISTS kontak_darurat_wa VARCHAR(30),
    ADD COLUMN IF NOT EXISTS is_anonim_default BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.relawan_profiles
    ADD COLUMN IF NOT EXISTS alias_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS topik_keahlian TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS rating_rata_rata NUMERIC(3, 2);
