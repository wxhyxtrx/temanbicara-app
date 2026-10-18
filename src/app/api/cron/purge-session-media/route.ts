import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 500;
const DEFAULT_RETENTION_DAYS = 30;

interface StaleMediaRow {
  id: string;
  media_path: string | null;
  bookings: {
    id: string;
    ended_at: string | null;
    cancelled_at: string | null;
  } | {
    id: string;
    ended_at: string | null;
    cancelled_at: string | null;
  }[] | null;
}

/**
 * Bandingkan dua string dengan timingSafeEqual yang aman terhadap perbedaan panjang.
 * Menggunakan digest SHA-256 (panjang 32 byte tetap) agar buffer selalu identik ukurannya.
 */
function safeTimingCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(Buffer.from(a, 'utf8')).digest();
  const hashB = crypto.createHash('sha256').update(Buffer.from(b, 'utf8')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * GET /api/cron/purge-session-media
 * Endpoint Vercel Cron untuk membersihkan media sesi yang melewati masa retensi (default 30 hari).
 * Dilindungi header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      return fail(401, 'UNAUTHORIZED', 'CRON_SECRET belum dikonfigurasi di server');
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    if (!authHeader) {
      return fail(401, 'UNAUTHORIZED', 'Header Authorization diperlukan');
    }

    const expectedHeader = `Bearer ${cronSecret}`;
    if (!safeTimingCompare(authHeader, expectedHeader)) {
      return fail(401, 'UNAUTHORIZED', 'Kredensial cron tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // 1. Ambil batas retensi dari system_settings (key: media_retention, default 30 hari)
    let retentionDays = DEFAULT_RETENTION_DAYS;
    try {
      const { data: settingRow } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'media_retention')
        .maybeSingle();

      if (settingRow?.value && typeof settingRow.value === 'object') {
        const val = settingRow.value as { days?: unknown };
        if (typeof val.days === 'number' && Number.isFinite(val.days) && val.days > 0) {
          retentionDays = Math.floor(val.days);
        }
      }
    } catch (err) {
      console.warn('Gagal membaca system_settings media_retention, fallback ke default 30 hari:', err);
      retentionDays = DEFAULT_RETENTION_DAYS;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    // 2. Ambil session_messages dengan media_path IS NOT NULL dari booking kadaluwarsa (maks 500)
    const { data: rows, error: selectError } = await supabaseAdmin
      .from('session_messages')
      .select(`
        id,
        media_path,
        bookings!inner (
          id,
          ended_at,
          cancelled_at
        )
      `)
      .not('media_path', 'is', null)
      .or(`ended_at.lt.${cutoffIso},cancelled_at.lt.${cutoffIso}`, { referencedTable: 'bookings' })
      .limit(BATCH_LIMIT);

    if (selectError) {
      return fail(500, 'QUERY_FAILED', selectError.message);
    }

    // Filter ketat sisi aplikasi untuk memastikan COALESCE(ended_at, cancelled_at) < cutoff
    const candidates = ((rows || []) as unknown as StaleMediaRow[]).filter((row) => {
      if (!row.media_path) return false;
      const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
      if (!booking) return false;
      const terminalDateStr = booking.ended_at || booking.cancelled_at;
      if (!terminalDateStr) return false;
      const terminalTime = new Date(terminalDateStr).getTime();
      return Number.isFinite(terminalTime) && terminalTime < cutoff.getTime();
    });

    const scanned = candidates.length;
    if (scanned === 0) {
      return NextResponse.json({
        success: true,
        scanned: 0,
        deleted: 0,
        failed: 0,
      });
    }

    // 3. Hapus berkas fisik dari bucket storage 'session-media'
    const pathsToDelete = Array.from(new Set(candidates.map((c) => c.media_path as string)));
    const { data: removedFiles, error: storageError } = await supabaseAdmin.storage
      .from('session-media')
      .remove(pathsToDelete);

    if (storageError) {
      return NextResponse.json(
        {
          success: false,
          error: 'STORAGE_DELETE_FAILED',
          message: storageError.message,
          scanned,
          deleted: 0,
          failed: scanned,
        },
        { status: 500 }
      );
    }

    // Cocokkan berkas yang terkonfirmasi terhapus dari storage
    const deletedNameSet = new Set((removedFiles || []).map((f) => f.name.replace(/^\/+/, '')));
    const isPathDeleted = (path: string): boolean => {
      const norm = path.replace(/^\/+/, '');
      if (deletedNameSet.has(norm)) return true;
      const filename = norm.split('/').pop();
      return Boolean(filename && deletedNameSet.has(filename));
    };

    const purgedMsgIds = candidates
      .filter((c) => c.media_path && isPathDeleted(c.media_path))
      .map((c) => c.id);

    // 4. Update baris di session_messages via RPC session_media_mark_purged
    if (purgedMsgIds.length > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('session_media_mark_purged', {
        p_message_ids: purgedMsgIds,
      });

      if (rpcError) {
        return fail(500, 'RPC_FAILED', rpcError.message);
      }
    }

    const deleted = purgedMsgIds.length;
    const failed = scanned - deleted;

    return NextResponse.json({
      success: true,
      scanned,
      deleted,
      failed,
    });
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    );
  }
}
