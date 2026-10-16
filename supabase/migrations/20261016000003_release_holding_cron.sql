-- ========================================================
-- TEMAN BICARA: PG_CRON RELEASE HOLDING JOB (FASE 2)
-- Eksekusi file ini di: Supabase Dashboard -> SQL Editor
-- Prasyarat: Ekstensi pg_cron diaktifkan untuk cron scheduling
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus job sebelumnya jika sudah ada agar migrasi bersifat idempoten
SELECT cron.unschedule('release-holding-job')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'release-holding-job'
);

-- Jadwalkan pelepasan holding honor mitra setiap 15 menit
SELECT cron.schedule(
    'release-holding-job',
    '*/15 * * * *',
    'SELECT public.release_holding(100);'
);
