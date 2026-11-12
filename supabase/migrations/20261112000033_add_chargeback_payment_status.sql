-- ========================================================
-- TEMAN BICARA: ADD CHARGEBACK TO PAYMENT_STATUS ENUM (PRD-049 / T-210)
-- Migration: 20261112000033_add_chargeback_payment_status.sql
-- ========================================================

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'chargeback';
