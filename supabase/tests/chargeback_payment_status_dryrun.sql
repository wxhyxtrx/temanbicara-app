-- ========================================================
-- TEMAN BICARA: DRY-RUN ADD CHARGEBACK TO PAYMENT_STATUS (PRD-049 / T-210)
-- Path: supabase/tests/chargeback_payment_status_dryrun.sql
-- ========================================================
-- Jalankan sebagai owner di lingkungan uji/dev; seluruh perubahan dibatalkan (ROLLBACK).

BEGIN;

-- Pastikan tipe public.payment_status tersedia jika dijalankan di lingkungan uji terisolasi
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending', 'settlement', 'deny', 'expire', 'cancel', 'refund');
    END IF;
END $$;

-- Terapkan migrasi penambahan nilai enum chargeback
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'chargeback';

-- Verifikasi nilai enum chargeback berhasil didaftarkan ke pg_enum
DO $$
DECLARE
    v_has_chargeback boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'payment_status'
          AND e.enumlabel = 'chargeback'
    ) INTO v_has_chargeback;

    ASSERT v_has_chargeback = true, 'Nilai enum chargeback tidak ditemukan pada public.payment_status';

    -- Seluruh assert berhasil
    RAISE EXCEPTION 'DRYRUN_OK';
END $$;

ROLLBACK;
