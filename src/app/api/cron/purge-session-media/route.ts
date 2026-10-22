import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail } from '@/lib/auth/session';
import { isValidPeerMediaPath } from '@/lib/validations/peer-messages';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 500;
const DEFAULT_RETENTION_DAYS = 30;

interface StaleSessionMediaRow {
  id: string;
  media_path: string | null;
  bookings:
    | {
        id: string;
        ended_at: string | null;
        cancelled_at: string | null;
      }
    | {
        id: string;
        ended_at: string | null;
        cancelled_at: string | null;
      }[]
    | null;
}

interface StalePeerMediaRow {
  id: string;
  media_path: string | null;
  peer_tickets:
    | {
        id: string;
        status: string;
        closed_at: string | null;
        archived_at: string | null;
      }
    | {
        id: string;
        status: string;
        closed_at: string | null;
        archived_at: string | null;
      }[]
    | null;
}

interface PurgePipelineResult {
  scanned: number;
  deleted: number;
  failed: number;
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
 * Endpoint Vercel Cron untuk membersihkan media sesi konseling dan sesi sebaya yang melewati masa retensi (default 30 hari).
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

    // ========================================================
    // Pipeline 1: Sesi Konseling Psikolog (session_messages)
    // ========================================================
    const sessionResult: PurgePipelineResult = {
      scanned: 0,
      deleted: 0,
      failed: 0,
    };
    let hasSessionError = false;

    try {
      const { data: sessionRows, error: selectSessionError } = await supabaseAdmin
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

      if (selectSessionError) {
        console.error('Session media select failed:', selectSessionError.message);
        hasSessionError = true;
      } else {
        const sessionCandidates = ((sessionRows || []) as unknown as StaleSessionMediaRow[]).filter((row) => {
          if (!row.media_path) return false;
          const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
          if (!booking) return false;
          const terminalDateStr = booking.ended_at || booking.cancelled_at;
          if (!terminalDateStr) return false;
          const terminalTime = new Date(terminalDateStr).getTime();
          return Number.isFinite(terminalTime) && terminalTime < cutoff.getTime();
        });

        sessionResult.scanned = sessionCandidates.length;

        if (sessionCandidates.length > 0) {
          const sessionPathsToDelete = Array.from(new Set(sessionCandidates.map((c) => c.media_path as string)));
          const { error: storageError } = await supabaseAdmin.storage
            .from('session-media')
            .remove(sessionPathsToDelete);

          if (storageError) {
            console.error('Session media storage delete failed:', storageError.message);
            sessionResult.failed = sessionResult.scanned;
            hasSessionError = true;
          } else {
            // Berkas fisik berhasil dihapus atau sudah hilang dari storage
            const sessionMsgIds = sessionCandidates.map((c) => c.id);
            const { data: updatedCount, error: rpcError } = await supabaseAdmin.rpc(
              'session_media_mark_purged',
              {
                p_message_ids: sessionMsgIds,
              }
            );

            if (rpcError) {
              console.error('Session media RPC session_media_mark_purged failed:', rpcError.message);
              sessionResult.failed = sessionResult.scanned;
              hasSessionError = true;
            } else {
              const deleted = typeof updatedCount === 'number' ? updatedCount : sessionMsgIds.length;
              sessionResult.deleted = deleted;
              sessionResult.failed = Math.max(0, sessionResult.scanned - deleted);
              if (sessionResult.failed > 0) {
                hasSessionError = true;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error in session media purge pipeline:', err);
      hasSessionError = true;
    }

    // ========================================================
    // Pipeline 2: Sesi Sebaya / Ruang Dengar (peer_messages)
    // ========================================================
    const peerResult: PurgePipelineResult = {
      scanned: 0,
      deleted: 0,
      failed: 0,
    };
    let hasPeerError = false;

    try {
      const { data: peerRows, error: selectPeerError } = await supabaseAdmin
        .from('peer_messages')
        .select(`
          id,
          media_path,
          peer_tickets!inner (
            id,
            status,
            closed_at,
            archived_at
          )
        `)
        .not('media_path', 'is', null)
        .in('peer_tickets.status', ['closed', 'archived'])
        .or(`closed_at.lt.${cutoffIso},archived_at.lt.${cutoffIso}`, { referencedTable: 'peer_tickets' })
        .limit(BATCH_LIMIT);

      if (selectPeerError) {
        console.error('Peer media select failed:', selectPeerError.message);
        hasPeerError = true;
      } else {
        const peerCandidates = ((peerRows || []) as unknown as StalePeerMediaRow[]).filter((row) => {
          if (!row.media_path) return false;
          const ticket = Array.isArray(row.peer_tickets) ? row.peer_tickets[0] : row.peer_tickets;
          if (!ticket) return false;
          if (ticket.status !== 'closed' && ticket.status !== 'archived') return false;

          const terminalDateStr = ticket.closed_at || ticket.archived_at;
          if (!terminalDateStr) return false;
          const terminalTime = new Date(terminalDateStr).getTime();
          if (!Number.isFinite(terminalTime) || terminalTime >= cutoff.getTime()) {
            return false;
          }

          return isValidPeerMediaPath(ticket.id, row.media_path);
        });

        peerResult.scanned = peerCandidates.length;

        if (peerCandidates.length > 0) {
          const peerPathsToDelete = Array.from(new Set(peerCandidates.map((c) => c.media_path as string)));
          const { error: storageError } = await supabaseAdmin.storage
            .from('session-media')
            .remove(peerPathsToDelete);

          if (storageError) {
            console.error('Peer media storage delete failed:', storageError.message);
            peerResult.failed = peerResult.scanned;
            hasPeerError = true;
          } else {
            // Berkas fisik berhasil dihapus atau sudah hilang dari storage
            const peerMsgIds = peerCandidates.map((c) => c.id);
            const { data: updatedCount, error: rpcError } = await supabaseAdmin.rpc(
              'peer_media_mark_purged',
              {
                p_message_ids: peerMsgIds,
              }
            );

            if (rpcError) {
              console.error('Peer media RPC peer_media_mark_purged failed:', rpcError.message);
              peerResult.failed = peerResult.scanned;
              hasPeerError = true;
            } else {
              const deleted = typeof updatedCount === 'number' ? updatedCount : peerMsgIds.length;
              peerResult.deleted = deleted;
              peerResult.failed = Math.max(0, peerResult.scanned - deleted);
              if (peerResult.failed > 0) {
                hasPeerError = true;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error in peer media purge pipeline:', err);
      hasPeerError = true;
    }

    // ========================================================
    // Agregasi & Respon JSON
    // ========================================================
    const scanned = sessionResult.scanned + peerResult.scanned;
    const deleted = sessionResult.deleted + peerResult.deleted;
    const failed = sessionResult.failed + peerResult.failed;
    const success = !hasSessionError && !hasPeerError && failed === 0;

    return NextResponse.json({
      success,
      scanned,
      deleted,
      failed,
      session: sessionResult,
      peer: peerResult,
    });
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    );
  }
}
