-- ========================================================
-- TEMAN BICARA: DRY-RUN TEST MIGRATION 000021 (PG_CRON PEER TICKET TICK)
-- Path: supabase/tests/peer_ticket_cron_dryrun.sql
-- Scope:
-- 1. Menguji ketersediaan ekstensi pg_cron
-- 2. Menguji unschedule idempoten untuk job 'peer-ticket-tick-job'
-- 3. Menguji pendaftaran cron.schedule untuk job 'peer-ticket-tick-job'
-- 4. Verifikasi dan assert keberadaan baris job di tabel cron.job
-- 5. Menguji pemanggilan ulang secara idempoten
-- SELURUH UJI BERJALAN DALAM SATU TRANSAKSI DAN OTOMATIS DI-ROLLBACK
-- ========================================================

BEGIN;

-- 1. Pastikan ekstensi pg_cron tersedia
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Hapus job sebelumnya jika ada agar bersifat idempoten
SELECT cron.unschedule('peer-ticket-tick-job')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'peer-ticket-tick-job'
);

-- 3. Jadwalkan pengecekan tiket timeout (10 menit) dan arsip (24 jam) setiap menit
SELECT cron.schedule(
    'peer-ticket-tick-job',
    '* * * * *',
    'SELECT public.peer_ticket_tick();'
);

-- 4. Assert keberadaan dan spesifikasi job di cron.job
DO $$
DECLARE
    v_job RECORD;
BEGIN
    SELECT * INTO v_job
    FROM cron.job
    WHERE jobname = 'peer-ticket-tick-job';

    ASSERT v_job.jobid IS NOT NULL, 'UJI CRON GAGAL: job peer-ticket-tick-job tidak ditemukan di cron.job';
    ASSERT v_job.schedule = '* * * * *', 'UJI CRON GAGAL: jadwal cron tidak sesuai (* * * * *)';
    ASSERT v_job.command = 'SELECT public.peer_ticket_tick();', 'UJI CRON GAGAL: command cron tidak sesuai';
END $$;

-- 5. Uji idempotensi: jalankan ulang unschedule dan schedule tanpa error
SELECT cron.unschedule('peer-ticket-tick-job')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'peer-ticket-tick-job'
);

SELECT cron.schedule(
    'peer-ticket-tick-job',
    '* * * * *',
    'SELECT public.peer_ticket_tick();'
);

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*)::INTEGER INTO v_count
    FROM cron.job
    WHERE jobname = 'peer-ticket-tick-job';

    ASSERT v_count = 1, 'UJI CRON GAGAL: jumlah job peer-ticket-tick-job setelah re-schedule idempoten bukan 1';
END $$;

DO $$
BEGIN
    RAISE NOTICE 'SEMUA PENGUJIAN DRY-RUN PEER TICKET CRON LULUS.';
END $$;

-- ========================================================
-- ROLLBACK UNTUK MENJAGA DATABASE TEST TETAP BERSIH
-- ========================================================
ROLLBACK;
