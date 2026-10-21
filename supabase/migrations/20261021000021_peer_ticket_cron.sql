-- ========================================================
-- TEMAN BICARA: PG_CRON PEER TICKET TICK JOB (FASE 3)
-- Prasyarat: Ekstensi pg_cron diaktifkan untuk cron scheduling
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus job sebelumnya jika sudah ada agar migrasi bersifat idempoten
SELECT cron.unschedule('peer-ticket-tick-job')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'peer-ticket-tick-job'
);

-- Jadwalkan pengecekan tiket timeout (10 menit) dan arsip (24 jam) setiap menit
SELECT cron.schedule(
    'peer-ticket-tick-job',
    '* * * * *',
    'SELECT public.peer_ticket_tick();'
);
