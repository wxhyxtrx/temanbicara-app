import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';
import type { PaginationMeta } from '@/types/wallet';

export type ActivityCategory = 'auth' | 'admin' | 'money' | 'session' | 'feedback' | 'safety';

export interface ActivityLogItem {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string;
  category: ActivityCategory;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  /** Lawan interaksi pada booking/curhat (nama samaran bila pasien memakai Mode Anonim). */
  counterpart_name?: string | null;
  counterpart_role?: string | null;
  /** Topik curhat (pilihan baku), hanya untuk tiket curhat. */
  topic?: string | null;
}

export interface ListActivityLogsOptions {
  page?: number;
  limit?: number;
  category?: ActivityCategory;
  actorId?: string;
  /** Kata kunci nama pelaku (min. 2 huruf). */
  q?: string;
  /** Tanggal WIB YYYY-MM-DD (inklusif). */
  from?: string;
  to?: string;
}

/** Mengambil log aktivitas (khusus admin). Melempar Error berisi pesan ramah bila gagal. */
export async function listActivityLogs(
  opts: ListActivityLogsOptions = {}
): Promise<{ items: ActivityLogItem[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  params.set('page', String(opts.page ?? 1));
  params.set('limit', String(opts.limit ?? 25));
  if (opts.category) params.set('category', opts.category);
  if (opts.actorId) params.set('actor_id', opts.actorId);
  if (opts.q && opts.q.trim().length >= 2) params.set('q', opts.q.trim());
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);

  const res = await fetch(`/api/admin/activity-logs?${params.toString()}`, { credentials: 'include' });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (res.status === 401) handleUnauthorized(body?.message || 'Sesi login tidak valid');
    throw new Error(body?.message || 'Gagal memuat log aktivitas');
  }
  return { items: body.data as ActivityLogItem[], meta: body.meta as PaginationMeta };
}
