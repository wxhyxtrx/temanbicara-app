-- ========================================================
-- TEMAN BICARA: REKENING BANK TERSIMPAN MITRA (PRD-043)
-- Migration: 20261111000027_mitra_bank_accounts.sql
-- ========================================================

-- 1. TABEL PUBLIC.MITRA_BANK_ACCOUNTS
-- Tabel penyimpan satu rekening bank pribadi per mitra (psikolog dan relawan)
-- sebagai nilai awal pencairan honor/reward.
CREATE TABLE IF NOT EXISTS public.mitra_bank_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_account_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Komentar Dokumentasi Skema
COMMENT ON TABLE public.mitra_bank_accounts IS 'Tabel rekening bank tersimpan untuk mitra (psikolog dan relawan) sebagai nilai awal pencairan honor/reward';
COMMENT ON COLUMN public.mitra_bank_accounts.user_id IS 'ID pengguna mitra pemilik rekening (FK users ON DELETE CASCADE)';
COMMENT ON COLUMN public.mitra_bank_accounts.bank_name IS 'Nama bank tujuan pencairan';
COMMENT ON COLUMN public.mitra_bank_accounts.account_number IS 'Nomor rekening bank mitra (6-20 digit angka)';
COMMENT ON COLUMN public.mitra_bank_accounts.bank_account_name IS 'Nama pemilik rekening bank sesuai buku tabungan';
COMMENT ON COLUMN public.mitra_bank_accounts.updated_at IS 'Waktu terakhir data rekening diperbarui';

-- 2. KEAMANAN RLS & HAK AKSES
-- Akses tabel tertutup penuh dari klien (tanpa policy klien).
-- Hanya service_role backend yang memiliki hak akses.
ALTER TABLE public.mitra_bank_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mitra_bank_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mitra_bank_accounts TO service_role;
