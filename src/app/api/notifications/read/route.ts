import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { markNotificationsReadSchema } from '@/lib/validations/notification';

/**
 * POST /api/notifications/read
 * Menandai notifikasi sebagai telah dibaca (read_at = now).
 * Menerima body: { all: true } atau { ids: string[] }.
 * Menggunakan service_role dan filter eksplisit user_id untuk keamanan RLS.
 */
export async function POST(req: Request) {
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

    const rawBody = await req.json().catch(() => null);
    const parsed = markNotificationsReadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data input tidak valid');
    }

    const { all, ids } = parsed.data;
    const now = new Date().toISOString();

    let updateQuery = supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (!all && ids && ids.length > 0) {
      updateQuery = updateQuery.in('id', ids);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select('id');

    if (updateError) {
      return fail(500, 'UPDATE_FAILED', updateError.message);
    }

    const updatedCount = updatedRows?.length ?? 0;

    return NextResponse.json({
      success: true,
      message: 'Notifikasi berhasil ditandai telah dibaca',
      data: {
        updated_count: updatedCount,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
