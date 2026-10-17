-- ========================================================
-- TEMAN BICARA: JADWAL PSIKOLOG (FASE 3 - TASK B2)
-- Migration: 20261017000010_psikolog_schedule.sql
-- ========================================================

-- 1. TABEL PSIKOLOG_SCHEDULES (Pola Mingguan)
CREATE TABLE IF NOT EXISTS public.psikolog_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0 = Minggu (WIB), 6 = Sabtu
    start_hour SMALLINT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour SMALLINT NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_psikolog_schedules_hours CHECK (end_hour > start_hour)
);

CREATE INDEX IF NOT EXISTS idx_psikolog_schedules_psikolog_weekday
    ON public.psikolog_schedules(psikolog_id, weekday);

-- 2. TABEL PSIKOLOG_TIME_OFF (Libur / Pengecualian)
CREATE TABLE IF NOT EXISTS public.psikolog_time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psikolog_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_psikolog_time_off_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_psikolog_time_off_psikolog_range
    ON public.psikolog_time_off(psikolog_id, start_at, end_at);

-- 3. KOLOM TAMBAHAN PADA PSIKOLOG_PROFILES
ALTER TABLE public.psikolog_profiles
    ADD COLUMN IF NOT EXISTS booking_paused BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS extension_price_coins INTEGER NULL,
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.psikolog_profiles.booking_paused IS 'Toggle jeda terima booking dari pasien';
COMMENT ON COLUMN public.psikolog_profiles.extension_price_coins IS 'Harga koin untuk ekstensi sesi 10 menit yang ditentukan psikolog';
COMMENT ON COLUMN public.psikolog_profiles.suspended_until IS 'Batas waktu penalti suspensi akibat akumulasi strike';

-- 4. ROW LEVEL SECURITY (RLS)
-- Diaktifkan tanpa policy untuk anon/authenticated; akses hanya via service_role API
ALTER TABLE public.psikolog_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psikolog_time_off ENABLE ROW LEVEL SECURITY;
