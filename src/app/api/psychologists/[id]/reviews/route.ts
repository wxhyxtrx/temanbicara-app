import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, pageParams } from '@/lib/auth/session';
import type { PublicReviewItem } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function formatMonthYearId(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  // Menyesuaikan ke zona waktu WIB (UTC+7)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const month = MONTH_NAMES_ID[wib.getMonth()] ?? '';
  const year = wib.getFullYear();
  return `${month} ${year}`;
}

/**
 * GET /api/psychologists/[id]/reviews
 * Mengambil daftar ulasan publik untuk satu profil psikolog.
 * Endpoint publik tanpa perlu autentikasi.
 * Review Focus #5: Bebas total dari identitas pasien (hanya rating, review, month).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID psikolog tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Pastikan psikolog aktif
    const { data: psiko, error: psikoError } = await supabaseAdmin
      .from('users')
      .select('id, role, status')
      .eq('id', id)
      .eq('role', 'psikolog')
      .eq('status', 'active')
      .maybeSingle();

    if (psikoError) {
      return fail(500, 'QUERY_FAILED', psikoError.message);
    }
    if (!psiko) {
      return fail(404, 'NOT_FOUND', 'Psikolog tidak ditemukan');
    }

    const { page, limit, from, to } = pageParams(new URL(req.url));

    const { data: reviews, error: reviewsError, count } = await supabaseAdmin
      .from('session_reviews')
      .select('rating, review, created_at', { count: 'exact' })
      .eq('psikolog_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (reviewsError) {
      return fail(500, 'QUERY_FAILED', reviewsError.message);
    }

    const formattedReviews: PublicReviewItem[] = (reviews ?? []).map((r) => ({
      rating: r.rating,
      review: r.review,
      month: formatMonthYearId(r.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: formattedReviews,
      meta: {
        page,
        limit,
        total: count ?? 0,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
