import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { notificationQuerySchema } from '@/lib/validations/notification';
import type { NotificationEntity } from '@/types/notification';

/**
 * GET /api/notifications
 * Mengambil daftar notifikasi in-app untuk pengguna yang sedang login.
 * Mendukung paginasi, filter belum dibaca (unread), dan mengembalikan total unread_count.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun Anda belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const url = new URL(req.url);
    const queryParsed = notificationQuerySchema.safeParse({
      page: url.searchParams.get('page') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      unread: url.searchParams.get('unread') || undefined,
    });

    if (!queryParsed.success) {
      return fail(422, 'VALIDATION_ERROR', queryParsed.error.issues[0]?.message || 'Parameter query tidak valid');
    }

    const { page, limit, unread } = queryParsed.data;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let listQuery = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (unread) {
      listQuery = listQuery.is('read_at', null);
    }

    const [listResult, unreadResult] = await Promise.all([
      listQuery.range(from, to),
      supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
    ]);

    if (listResult.error) {
      return fail(500, 'QUERY_FAILED', listResult.error.message);
    }

    const notifications = (listResult.data || []) as NotificationEntity[];
    const total = listResult.count ?? notifications.length;
    const unreadCount = unreadResult.count ?? 0;

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      unread_count: unreadCount,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
