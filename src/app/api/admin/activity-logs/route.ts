import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, pageParams } from '@/lib/auth/session';

const querySchema = z.object({
  category: z.enum(['auth', 'admin', 'money']).optional(),
  actor_role: z.enum(['pasien', 'psikolog', 'relawan', 'admin', 'system', 'guest']).optional(),
  action: z.string().regex(/^[a-z_]+\.[a-z_]+$/).optional(),
  actor_id: z.string().uuid().optional(),
});

interface ActivityLogRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_role: string;
  category: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
}

interface ActorRow {
  id: string;
  pasien_profiles?: { nama_lengkap: string } | null;
  relawan_profiles?: { nama_lengkap: string } | null;
  psikolog_profiles?: { nama_lengkap_gelar: string } | null;
  admin_profiles?: { nama_lengkap: string } | null;
}

/**
 * GET /api/admin/activity-logs
 * Daftar log aktivitas seluruh pengguna (terbaru dulu), khusus admin aktif.
 * Filter opsional: category, actor_role, action, actor_id. Paginasi: page, limit (maks 100).
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin aktif yang dapat melihat log aktivitas');
    }
    if (!supabaseAdmin) return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      category: url.searchParams.get('category') || undefined,
      actor_role: url.searchParams.get('actor_role') || undefined,
      action: url.searchParams.get('action') || undefined,
      actor_id: url.searchParams.get('actor_id') || undefined,
    });
    if (!parsed.success) return fail(400, 'VALIDATION_ERROR', 'Parameter filter tidak valid');

    const { page, limit, from, to } = pageParams(url, 25);
    const f = parsed.data;

    let query = supabaseAdmin
      .from('activity_logs')
      .select('id, created_at, actor_id, actor_role, category, action, target_type, target_id, metadata', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (f.category) query = query.eq('category', f.category);
    if (f.actor_role) query = query.eq('actor_role', f.actor_role);
    if (f.action) query = query.eq('action', f.action);
    if (f.actor_id) query = query.eq('actor_id', f.actor_id);

    const { data, error, count } = await query;
    if (error) {
      console.error('[ACTIVITY_LOGS_QUERY_ERROR]:', error.code);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat log aktivitas');
    }

    const rows = (data ?? []) as ActivityLogRow[];
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id)));

    // 1 query nama aktor untuk seluruh halaman (tanpa N+1)
    const names = new Map<string, string>();
    if (actorIds.length) {
      const { data: actors } = await supabaseAdmin
        .from('users')
        .select(
          'id, pasien_profiles(nama_lengkap), relawan_profiles(nama_lengkap), ' +
            'psikolog_profiles(nama_lengkap_gelar), admin_profiles(nama_lengkap)'
        )
        .in('id', actorIds);
      for (const a of (actors ?? []) as unknown as ActorRow[]) {
        const name =
          a.pasien_profiles?.nama_lengkap ||
          a.relawan_profiles?.nama_lengkap ||
          a.psikolog_profiles?.nama_lengkap_gelar ||
          a.admin_profiles?.nama_lengkap;
        if (name) names.set(a.id, name);
      }
    }

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...r, actor_name: r.actor_id ? names.get(r.actor_id) ?? null : null })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err: unknown) {
    console.error('[ACTIVITY_LOGS_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'unknown');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat log aktivitas');
  }
}
