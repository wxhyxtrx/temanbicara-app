import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { AdminCrisisAlertsResponse, CrisisAlertItem, CrisisAlertStatus } from '@/types/crisis';

const VALID_STATUSES = ['all', 'new', 'handled', 'false_alarm'] as const;

/**
 * GET /api/admin/crisis-alerts
 * Feed alarm eskalasi krisis keselamatan pasien terpusat untuk admin.
 * Mendukung filter status ('all' | 'new' | 'handled' | 'false_alarm'),
 * paginasi, pengurutan status 'new' di atas & created_at DESC,
 * display name aman untuk pasien, serta mengembalikan unhandled_count.
 * Syarat: Role admin aktif.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang memiliki wewenang mengakses feed krisis');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun admin belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const url = new URL(req.url);

    // 1. Filter status
    const rawStatus = (url.searchParams.get('status') || 'all').toLowerCase();
    if (!VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])) {
      return fail(400, 'INVALID_STATUS', "Filter status harus salah satu dari: 'all', 'new', 'handled', 'false_alarm'");
    }

    // 2. Paginasi: limit maksimal 50
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const rawLimit = Number(url.searchParams.get('limit')) || 20;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    // 3. Query daftar alert
    let query = supabaseAdmin
      .from('crisis_alerts')
      .select('*', { count: 'exact' });

    if (rawStatus !== 'all') {
      query = query.eq('status', rawStatus);
    }

    // Urutkan status = 'new' di atas (descending: 'new' > 'handled' > 'false_alarm') dan created_at DESC
    query = query
      .order('status', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Hitung unhandled_count (status 'new') secara paralel
    const [queryResult, unhandledRes] = await Promise.all([
      query,
      supabaseAdmin
        .from('crisis_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new'),
    ]);

    const { data: alerts, error: queryError, count } = queryResult;

    if (queryError) {
      console.error('[ADMIN_CRISIS_ALERTS_QUERY_ERROR]:', queryError.code || queryError.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat daftar alert krisis');
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const unhandledCount = unhandledRes.count ?? 0;

    const alertList = alerts ?? [];
    if (alertList.length === 0) {
      const emptyResponse: AdminCrisisAlertsResponse = {
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          unhandled_count: unhandledCount,
        },
      };
      return NextResponse.json(emptyResponse);
    }

    // 4. Kumpulkan ID untuk relasi (display name aman, pendamping/reporter, handler)
    const bookingIds = Array.from(new Set(alertList.filter((a) => a.booking_id).map((a) => a.booking_id as string)));
    const ticketIds = Array.from(new Set(alertList.filter((a) => a.ticket_id).map((a) => a.ticket_id as string)));
    const patientIds = Array.from(new Set(alertList.map((a) => a.patient_id as string)));
    const reporterIds = Array.from(new Set(alertList.filter((a) => a.reporter_id).map((a) => a.reporter_id as string)));
    const handledByIds = Array.from(new Set(alertList.filter((a) => a.handled_by).map((a) => a.handled_by as string)));

    const [bookingsRes, ticketsRes, patientsRes, psikologsRes, relawansRes, adminsRes] = await Promise.all([
      bookingIds.length > 0
        ? supabaseAdmin.from('bookings').select('id, patient_display_name').in('id', bookingIds)
        : Promise.resolve({ data: [] }),
      ticketIds.length > 0
        ? supabaseAdmin.from('peer_tickets').select('id, patient_alias').in('id', ticketIds)
        : Promise.resolve({ data: [] }),
      patientIds.length > 0
        ? supabaseAdmin.from('pasien_profiles').select('user_id, nama_panggilan, nama_lengkap, is_anonim_default').in('user_id', patientIds)
        : Promise.resolve({ data: [] }),
      reporterIds.length > 0
        ? supabaseAdmin.from('psikolog_profiles').select('user_id, nama_lengkap_gelar').in('user_id', reporterIds)
        : Promise.resolve({ data: [] }),
      reporterIds.length > 0
        ? supabaseAdmin.from('relawan_profiles').select('user_id, nama_lengkap').in('user_id', reporterIds)
        : Promise.resolve({ data: [] }),
      handledByIds.length > 0
        ? supabaseAdmin.from('admin_profiles').select('user_id, nama_lengkap').in('user_id', handledByIds)
        : Promise.resolve({ data: [] }),
    ]);

    const bookingMap = new Map<string, string>();
    for (const b of bookingsRes.data || []) {
      if (b.patient_display_name) bookingMap.set(b.id, b.patient_display_name);
    }

    const ticketMap = new Map<string, string>();
    for (const t of ticketsRes.data || []) {
      if (t.patient_alias) ticketMap.set(t.id, t.patient_alias);
    }

    const patientProfileMap = new Map<
      string,
      { nama_panggilan?: string | null; nama_lengkap?: string | null; is_anonim_default?: boolean | null }
    >();
    for (const p of patientsRes.data || []) {
      patientProfileMap.set(p.user_id, p);
    }

    const reporterMap = new Map<string, string>();
    for (const r of psikologsRes.data || []) {
      reporterMap.set(r.user_id, r.nama_lengkap_gelar);
    }
    for (const r of relawansRes.data || []) {
      if (!reporterMap.has(r.user_id)) {
        reporterMap.set(r.user_id, r.nama_lengkap);
      }
    }

    const adminMap = new Map<string, string>();
    for (const a of adminsRes.data || []) {
      adminMap.set(a.user_id, a.nama_lengkap);
    }

    // 5. Bentuk item respons dengan display name aman (dilarang membocorkan data kontak/asli)
    const items: CrisisAlertItem[] = alertList.map((a) => {
      let patientDisplayName = 'Pasien Anonim';
      if (a.source === 'booking' && a.booking_id && bookingMap.has(a.booking_id)) {
        patientDisplayName = bookingMap.get(a.booking_id)!;
      } else if (a.source === 'peer_ticket' && a.ticket_id && ticketMap.has(a.ticket_id)) {
        patientDisplayName = ticketMap.get(a.ticket_id)!;
      } else if (patientProfileMap.has(a.patient_id)) {
        const prof = patientProfileMap.get(a.patient_id)!;
        if (prof.is_anonim_default) {
          patientDisplayName = 'Pasien Anonim';
        } else if (prof.nama_panggilan && prof.nama_panggilan.trim()) {
          patientDisplayName = prof.nama_panggilan.trim();
        } else if (prof.nama_lengkap && prof.nama_lengkap.trim()) {
          patientDisplayName = prof.nama_lengkap.trim().split(' ')[0] || 'Pasien';
        } else {
          patientDisplayName = 'Pasien';
        }
      }

      const reporterName = a.reporter_id ? reporterMap.get(a.reporter_id) || 'Pendamping' : null;
      const handlerName = a.handled_by ? adminMap.get(a.handled_by) || 'Admin' : null;

      return {
        id: a.id,
        source: a.source,
        booking_id: a.booking_id,
        ticket_id: a.ticket_id,
        patient_id: a.patient_id,
        patient_display_name: patientDisplayName,
        detected_by: a.detected_by,
        reporter_id: a.reporter_id,
        reporter_name: reporterName,
        category: a.category,
        snippet: a.snippet,
        hit_count: a.hit_count,
        status: a.status as CrisisAlertStatus,
        handled_by: a.handled_by,
        handler_name: handlerName,
        handled_at: a.handled_at,
        admin_note: a.admin_note,
        created_at: a.created_at,
      };
    });

    const responsePayload: AdminCrisisAlertsResponse = {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        unhandled_count: unhandledCount,
      },
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    // Sanitasi log server: dilarang mencatat snippet atau teks krisis ke log
    console.error('[ADMIN_CRISIS_ALERTS_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'Unknown error');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memproses feed krisis');
  }
}
