import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser, pageParams } from '@/lib/auth/session';
import type { AdminReviewItem } from '@/types/booking';

/**
 * GET /api/admin/reviews
 * Moderasi ulasan oleh admin: daftar ulasan dengan filter reported/hidden/semua.
 * Urutan: reported_at terbaru dulu (nulls last) lalu created_at terbaru.
 * Syarat: Role admin aktif.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses daftar ulasan');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun admin belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const url = new URL(req.url);
    const { page, limit, from, to } = pageParams(url, 20);

    const filter = (url.searchParams.get('filter') || url.searchParams.get('status') || 'semua').toLowerCase();

    let query = supabaseAdmin
      .from('session_reviews')
      .select('booking_id, patient_id, psikolog_id, rating, review, is_hidden, reported_at, created_at, updated_at', {
        count: 'exact',
      });

    if (filter === 'reported') {
      query = query.not('reported_at', 'is', null);
    } else if (filter === 'hidden') {
      query = query.eq('is_hidden', true);
    }

    // Urut reported_at terbaru dulu, lalu created_at terbaru
    query = query
      .order('reported_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const [queryResult, totalRes, reportedRes, hiddenRes] = await Promise.all([
      query,
      supabaseAdmin.from('session_reviews').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('session_reviews').select('*', { count: 'exact', head: true }).not('reported_at', 'is', null),
      supabaseAdmin.from('session_reviews').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
    ]);

    const { data: reviews, error: reviewsError, count } = queryResult;

    if (reviewsError) {
      return fail(500, 'QUERY_FAILED', reviewsError.message);
    }

    const stats = {
      total: totalRes.count ?? 0,
      reported: reportedRes.count ?? 0,
      hidden: hiddenRes.count ?? 0,
    };

    const reviewList = reviews ?? [];
    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    if (reviewList.length === 0) {
      return NextResponse.json({
        success: true,
        data: [] as AdminReviewItem[],
        stats,
        pagination: { page, limit, total: 0, totalPages: 1 },
        meta: { page, limit, total: 0, totalPages: 1 },
      });
    }

    const bookingIds = reviewList.map((r) => r.booking_id);
    const psikologIds = Array.from(new Set(reviewList.map((r) => r.psikolog_id)));

    const [bookingsRes, psikologProfilesRes] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('id, start_at, patient_display_name')
        .in('id', bookingIds),
      supabaseAdmin
        .from('psikolog_profiles')
        .select('user_id, nama_lengkap_gelar')
        .in('user_id', psikologIds),
    ]);

    const bookingMap = new Map<string, { start_at: string | null; patient_display_name: string }>();
    for (const b of bookingsRes.data || []) {
      bookingMap.set(b.id, {
        start_at: b.start_at,
        patient_display_name: b.patient_display_name,
      });
    }

    const psikologMap = new Map<string, string>();
    for (const p of psikologProfilesRes.data || []) {
      psikologMap.set(p.user_id, p.nama_lengkap_gelar);
    }

    const items: AdminReviewItem[] = reviewList.map((r) => {
      const bInfo = bookingMap.get(r.booking_id);
      const namaPsikolog = psikologMap.get(r.psikolog_id) || 'Psikolog';
      const patientDisplayName = bInfo?.patient_display_name || 'Pasien Anonim';
      const sessionDate = bInfo?.start_at || null;

      return {
        id: r.booking_id,
        booking_id: r.booking_id,
        patient_id: r.patient_id,
        psikolog_id: r.psikolog_id,
        rating: r.rating,
        review: r.review,
        is_hidden: r.is_hidden,
        reported_at: r.reported_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        nama_lengkap_gelar: namaPsikolog,
        patient_display_name: patientDisplayName,
        start_at: sessionDate,
        session_date: sessionDate,
        tanggal_sesi: sessionDate,
      };
    });

    return NextResponse.json({
      success: true,
      data: items,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
