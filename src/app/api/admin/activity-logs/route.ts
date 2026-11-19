import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, pageParams, sanitizeSearch } from '@/lib/auth/session';

const querySchema = z.object({
  category: z.enum(['auth', 'admin', 'money', 'session', 'feedback']).optional(),
  actor_role: z.enum(['pasien', 'psikolog', 'relawan', 'admin', 'system', 'guest']).optional(),
  action: z.string().regex(/^[a-z_]+\.[a-z_]+$/).optional(),
  actor_id: z.string().uuid().optional(),
  /** Tanggal WIB format YYYY-MM-DD (inklusif). */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Cari ID pengguna yang namanya (nama lengkap, panggilan, alias, gelar) cocok dengan kata kunci. */
async function findUserIdsByName(db: NonNullable<typeof supabaseAdmin>, q: string): Promise<string[]> {
  const like = `%${q}%`;
  const [pasien, relawan, psikolog, admin] = await Promise.all([
    db.from('pasien_profiles').select('user_id').or(`nama_lengkap.ilike.${like},nama_panggilan.ilike.${like}`).limit(50),
    db.from('relawan_profiles').select('user_id').or(`nama_lengkap.ilike.${like},alias_name.ilike.${like}`).limit(50),
    db.from('psikolog_profiles').select('user_id').ilike('nama_lengkap_gelar', like).limit(50),
    db.from('admin_profiles').select('user_id').ilike('nama_lengkap', like).limit(50),
  ]);
  const ids = new Set<string>();
  for (const res of [pasien, relawan, psikolog, admin]) {
    for (const row of (res.data ?? []) as { user_id: string }[]) ids.add(row.user_id);
  }
  return Array.from(ids);
}

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
  role?: string;
  pasien_profiles?: { nama_lengkap: string; nama_panggilan?: string | null; is_anonim_default?: boolean | null } | null;
  relawan_profiles?: { nama_lengkap: string } | null;
  psikolog_profiles?: { nama_lengkap_gelar: string } | null;
  admin_profiles?: { nama_lengkap: string } | null;
}

/**
 * GET /api/admin/activity-logs
 * Daftar log aktivitas seluruh pengguna (terbaru dulu), khusus admin aktif.
 * Filter opsional: category, actor_role, action, actor_id, q (nama pelaku), from/to (tanggal WIB).
 * Paginasi: page, limit (maks 100).
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
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
    });
    if (!parsed.success) return fail(400, 'VALIDATION_ERROR', 'Parameter filter tidak valid');

    const { page, limit, from, to } = pageParams(url, 25);
    const f = parsed.data;
    const emptyPage = () =>
      NextResponse.json({ success: true, data: [], meta: { page, limit, total: 0, totalPages: 1 } });

    const q = sanitizeSearch(url.searchParams.get('q'));
    let nameMatchIds: string[] | null = null;
    if (q.length >= 2) {
      nameMatchIds = await findUserIdsByName(supabaseAdmin, q);
      if (nameMatchIds.length === 0) return emptyPage();
    }

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
    if (nameMatchIds) query = query.in('actor_id', nameMatchIds);
    if (f.from) query = query.gte('created_at', `${f.from}T00:00:00+07:00`);
    if (f.to) query = query.lte('created_at', `${f.to}T23:59:59.999+07:00`);

    const { data, error, count } = await query;
    if (error) {
      console.error('[ACTIVITY_LOGS_QUERY_ERROR]:', error.code);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat log aktivitas');
    }

    const rows = (data ?? []) as ActivityLogRow[];

    // Peserta booking/curhat agar log bisa menampilkan "A dengan B" tanpa isi percakapan.
    const idsOf = (type: string) =>
      Array.from(new Set(rows.filter((r) => r.target_type === type && r.target_id).map((r) => r.target_id as string)));
    const bookingIds = idsOf('booking');
    const ticketIds = idsOf('peer_ticket');
    const [bookingsRes, ticketsRes] = await Promise.all([
      bookingIds.length
        ? supabaseAdmin.from('bookings').select('id, patient_id, psikolog_id').in('id', bookingIds)
        : Promise.resolve({ data: [] as { id: string; patient_id: string; psikolog_id: string }[] }),
      ticketIds.length
        ? supabaseAdmin.from('peer_tickets').select('id, patient_id, claimed_by, topic, patient_alias').in('id', ticketIds)
        : Promise.resolve({
            data: [] as { id: string; patient_id: string; claimed_by: string | null; topic: string; patient_alias: string | null }[],
          }),
    ]);
    const bookingMap = new Map((bookingsRes.data ?? []).map((b) => [b.id, b]));
    const ticketMap = new Map((ticketsRes.data ?? []).map((t) => [t.id, t]));

    const participantsOf = (r: ActivityLogRow): { patient: string | null; mitra: string | null } => {
      if (r.target_type === 'booking' && r.target_id && bookingMap.has(r.target_id)) {
        const b = bookingMap.get(r.target_id)!;
        return { patient: b.patient_id, mitra: b.psikolog_id };
      }
      if (r.target_type === 'peer_ticket' && r.target_id && ticketMap.has(r.target_id)) {
        const t = ticketMap.get(r.target_id)!;
        return { patient: t.patient_id, mitra: t.claimed_by };
      }
      return { patient: null, mitra: null };
    };
    const counterpartOf = (r: ActivityLogRow): string | null => {
      const { patient, mitra } = participantsOf(r);
      if (!patient && !mitra) return null;
      if (r.actor_id && r.actor_id === patient) return mitra;
      if (r.actor_id && r.actor_id === mitra) return patient;
      return patient; // aksi admin/sistem: tampilkan pasien
    };

    const userIds = new Set<string>();
    for (const r of rows) {
      if (r.actor_id) userIds.add(r.actor_id);
      const c = counterpartOf(r);
      if (c) userIds.add(c);
    }

    // 1 query nama untuk seluruh halaman (tanpa N+1)
    const users = new Map<string, ActorRow>();
    if (userIds.size) {
      const { data: actors } = await supabaseAdmin
        .from('users')
        .select(
          'id, role, pasien_profiles(nama_lengkap, nama_panggilan, is_anonim_default), relawan_profiles(nama_lengkap), ' +
            'psikolog_profiles(nama_lengkap_gelar), admin_profiles(nama_lengkap)'
        )
        .in('id', Array.from(userIds));
      for (const a of (actors ?? []) as unknown as ActorRow[]) users.set(a.id, a);
    }

    // Pasien dengan Mode Anonim tampil dengan nama samaran (aturan yang sama dengan Feed Krisis).
    const nameOf = (userId: string | null, r: ActivityLogRow): string | null => {
      if (!userId) return null;
      const u = users.get(userId);
      if (!u) return null;
      if (u.pasien_profiles) {
        if (u.pasien_profiles.is_anonim_default) {
          const t = r.target_type === 'peer_ticket' && r.target_id ? ticketMap.get(r.target_id) : undefined;
          return t?.patient_alias || 'Pasien Anonim';
        }
        return u.pasien_profiles.nama_lengkap || null;
      }
      return u.relawan_profiles?.nama_lengkap || u.psikolog_profiles?.nama_lengkap_gelar || u.admin_profiles?.nama_lengkap || null;
    };

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data: rows.map((r) => {
        const counterpartId = counterpartOf(r);
        const ticket = r.target_type === 'peer_ticket' && r.target_id ? ticketMap.get(r.target_id) : undefined;
        return {
          ...r,
          actor_name: nameOf(r.actor_id, r),
          counterpart_name: nameOf(counterpartId, r),
          counterpart_role: counterpartId ? users.get(counterpartId)?.role ?? null : null,
          topic: ticket?.topic ?? null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err: unknown) {
    console.error('[ACTIVITY_LOGS_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'unknown');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat log aktivitas');
  }
}
