import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { reviewHideSchema } from '@/lib/validations/booking';
import type { SessionReviewEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/reviews/[id]
 * Moderasi ulasan oleh admin: menyembunyikan atau menampilkan kembali ulasan publik.
 * Syarat: Role admin aktif.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID ulasan booking tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat memoderasi ulasan');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun admin belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = reviewHideSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data moderasi tidak valid');
    }

    // Panggil RPC review_set_hidden
    const { data: review, error: rpcError } = await supabaseAdmin.rpc('review_set_hidden', {
      p_booking_id: id,
      p_is_hidden: parsed.data.is_hidden,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('REVIEW_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Ulasan tidak ditemukan');
      }
      return fail(400, 'MODERATION_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: review as SessionReviewEntity,
      message: parsed.data.is_hidden
        ? 'Ulasan berhasil disembunyikan dari tampilan publik'
        : 'Ulasan berhasil ditampilkan kembali ke publik',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
