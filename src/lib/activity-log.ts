import { supabaseAdmin } from '@/lib/supabase/client';

export type ActivityCategory = 'auth' | 'admin' | 'money' | 'session' | 'feedback';
export type ActivityActorRole = 'pasien' | 'psikolog' | 'relawan' | 'admin' | 'system' | 'guest';
export type ActivityMetadata = Record<string, string | number | boolean | null>;

export interface ActivityLogInput {
  actorId?: string | null;
  actorRole: ActivityActorRole;
  category: ActivityCategory;
  /** Format `objek.kejadian`, mis. `auth.login`, `payout.paid`. */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: ActivityMetadata;
}

type DbClient = typeof supabaseAdmin;

const ACTION_RE = /^[a-z_]+\.[a-z_]+$/;
// Kunci yang berpotensi memuat data pribadi/rahasia tidak pernah masuk log.
const FORBIDDEN_KEY_RE = /pass|token|secret|email|account|rekening|no_wa|phone|signature|key/i;
const MAX_STRING = 200;

export function sanitizeActivityMetadata(metadata?: ActivityMetadata): ActivityMetadata {
  const clean: ActivityMetadata = {};
  if (!metadata) return clean;
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY_RE.test(key)) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING);
    else if (typeof value === 'number' && !Number.isFinite(value)) continue;
    else clean[key] = value;
  }
  return clean;
}

/**
 * Mencatat log aktivitas (append-only). Best-effort: tidak pernah melempar error
 * sehingga kegagalan pencatatan tidak menggagalkan aksi utama pengguna.
 */
export async function logActivity(input: ActivityLogInput, deps?: { client?: DbClient }): Promise<void> {
  try {
    const db = deps?.client ?? supabaseAdmin;
    if (!db || !ACTION_RE.test(input.action)) return;

    const { error } = await db.from('activity_logs').insert({
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole,
      category: input.category,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: sanitizeActivityMetadata(input.metadata),
    });
    if (error) console.warn('[ACTIVITY_LOG] Gagal mencatat', input.action, error.code ?? '');
  } catch {
    console.warn('[ACTIVITY_LOG] Gagal mencatat', input.action);
  }
}
