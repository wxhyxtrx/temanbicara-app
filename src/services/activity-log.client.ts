import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';
import type { PaginationMeta } from '@/types/wallet';

export type ActivityCategory = 'auth' | 'admin' | 'money';

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
}

export interface ListActivityLogsOptions {
  page?: number;
  limit?: number;
  category?: ActivityCategory;
}

/** Mengambil log aktivitas (khusus admin). Melempar Error berisi pesan ramah bila gagal. */
export async function listActivityLogs(
  opts: ListActivityLogsOptions = {}
): Promise<{ items: ActivityLogItem[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  params.set('page', String(opts.page ?? 1));
  params.set('limit', String(opts.limit ?? 25));
  if (opts.category) params.set('category', opts.category);

  const res = await fetch(`/api/admin/activity-logs?${params.toString()}`, { credentials: 'include' });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (res.status === 401) handleUnauthorized(body?.message || 'Sesi login tidak valid');
    throw new Error(body?.message || 'Gagal memuat log aktivitas');
  }
  return { items: body.data as ActivityLogItem[], meta: body.meta as PaginationMeta };
}
