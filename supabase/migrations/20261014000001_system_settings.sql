-- ========================================================
-- TEMAN BICARA: SYSTEM SETTINGS & AUDIT MIGRATION (FASE 1)
-- Eksekusi file ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ========================================================

-- 1. TABEL SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. TABEL SYSTEM_SETTINGS_AUDIT
CREATE TABLE IF NOT EXISTS public.system_settings_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_system_settings_audit_key_changed_at
    ON public.system_settings_audit(key, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_settings_audit_changed_at
    ON public.system_settings_audit(changed_at DESC);

-- 3. SEED DEFAULT SYSTEM SETTINGS (§3 Spec v1.1)
INSERT INTO public.system_settings (key, value)
VALUES
    ('maintenance', '{"scheduled_start": null, "estimated_end": null, "message": ""}'::jsonb),
    ('topup', '{"min_coins": 10, "max_coins": 500}'::jsonb),
    ('revenue_share', '{"mitra_bps": 8000}'::jsonb),
    ('tip', '{"min_coins": 1, "max_coins": 50, "daily_cap_coins_per_patient": 50}'::jsonb),
    ('holding', '{"hours": 48}'::jsonb),
    ('payout', '{"min_rupiah": 1000000, "max_rupiah": 10000000, "fee_rupiah": 6500}'::jsonb),
    ('refund_policy', '[{"min_minutes_before": 60, "refund_pct": 100}, {"min_minutes_before": 30, "refund_pct": 65}, {"min_minutes_before": 0, "refund_pct": 0}]'::jsonb),
    ('psikolog_late', '{"minutes": 10}'::jsonb),
    ('patient_noshow', '{"minutes": 30}'::jsonb),
    ('extension_price', '{"min_coins": 1, "max_coins": 10}'::jsonb),
    ('relawan', '{"daily_ticket_quota": 3, "claim_response_minutes": 10, "unclaimed_archive_hours": 24, "max_carry_penalty": 1}'::jsonb),
    ('upload', '{"verification_max_mb": 5, "chat_media_max_mb": 10, "voice_note_max_seconds": 180}'::jsonb),
    ('media_retention', '{"days": 30}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. TRIGGER ATOMIK: AUDIT LOG SYSTEM SETTINGS
-- Menjamin setiap INSERT/UPDATE ke system_settings otomatis tercatat di audit dalam SATU transaksi ACID.
CREATE OR REPLACE FUNCTION public.trg_audit_system_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value) OR (TG_OP = 'INSERT') THEN
        INSERT INTO public.system_settings_audit (
            key,
            old_value,
            new_value,
            changed_by,
            changed_at
        ) VALUES (
            NEW.key,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
            NEW.value,
            NEW.updated_by,
            NEW.updated_at
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_settings_audit ON public.system_settings;
CREATE TRIGGER trg_system_settings_audit
AFTER INSERT OR UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_system_setting();

-- 5. RPC BATCH UPDATE ATOMIK
CREATE OR REPLACE FUNCTION public.update_system_settings_batch(
    p_entries JSONB,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_key TEXT;
    v_val JSONB;
BEGIN
    FOR v_key, v_val IN SELECT * FROM pg_catalog.jsonb_each(p_entries)
    LOOP
        INSERT INTO public.system_settings (key, value, updated_by, updated_at)
        VALUES (v_key, v_val, p_user_id, pg_catalog.timezone('utc', pg_catalog.now()))
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_system_settings_batch(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_system_settings_batch(jsonb, uuid) TO service_role;

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

-- POLICIES: SYSTEM_SETTINGS
-- Proteksi ketat: Anon, Pasien, dan Relawan TIDAK BISA membaca/menulis tabel ini langsung dari Supabase client.
-- Akses publik wajib melalui API Server (/api/settings/public via service_role).
-- Admin boleh membaca langsung untuk kebutuhan admin; semua penulisan melalui service_role.
CREATE POLICY "Admin only read system_settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- POLICIES: SYSTEM_SETTINGS_AUDIT
-- Audit hanya dibaca admin. Penulisan dilakukan trigger SECURITY DEFINER, bukan dari client.
CREATE POLICY "Admin only read system_settings_audit"
ON public.system_settings_audit FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
