-- ========================================================
-- TEMAN BICARA: SYSTEM SETTINGS FASE 3 (BOOKING, STRIKE, RATING)
-- Migration: 20261017000009_booking_settings.sql
-- ========================================================

-- Seed pengaturan admin baru Fase 3: booking, strike, rating
INSERT INTO public.system_settings (key, value)
VALUES
    (
        'booking',
        '{"min_hours_before": 2, "max_days_ahead": 14, "max_active_per_patient": 3, "max_per_psikolog_per_day": 1, "reschedule_min_hours": 24, "psikolog_cancel_free_hours": 24, "choice_deadline_hours": 48}'::jsonb
    ),
    (
        'strike',
        '{"per_late_cancel": 1, "per_noshow": 2, "threshold": 3, "window_days": 30, "suspend_days": 7}'::jsonb
    ),
    (
        'rating',
        '{"window_days": 7, "min_count_to_show": 3}'::jsonb
    )
ON CONFLICT (key) DO NOTHING;
