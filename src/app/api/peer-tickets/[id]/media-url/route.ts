import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import {
  peerMediaUploadSchema,
  isValidPeerMediaPath,
} from '@/lib/validations/peer-messages';
import type {
  PeerMediaUploadResponse,
  PeerMediaUrlResponse,
} from '@/lib/validations/peer-messages';
import type { PeerTicketEntity } from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_EXPIRES_IN_SECONDS = 600;

/**
 * GET /api/peer-tickets/[id]/media-url?path=...
 * Menghasilkan signed view URL (600 detik) untuk berkas media di private bucket session-media.
 * Akses khusus peserta tiket (pasien atau relawan) atau admin.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'draining') {
      return fail(503, 'MAINTENANCE_DRAINING', 'Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda.');
    }
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tiket tidak valid');
    }

    const { searchParams } = new URL(req.url);
    const mediaPath = searchParams.get('path')?.trim();
    if (!mediaPath) {
      return fail(400, 'INVALID_PAYLOAD', 'Parameter query "path" wajib disertakan');
    }

    if (!isValidPeerMediaPath(id, mediaPath)) {
      return fail(400, 'INVALID_PATH', 'Format path berkas tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_id, claimed_by, status')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticket) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const isPatient = user.id === ticket.patient_id;
    const isRelawan = user.id === ticket.claimed_by;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isRelawan && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat mengakses berkas media ini');
    }

    // Validasi keberadaan berkas: path harus tercatat pada peer_messages tiket tersebut
    const { data: msgMatch, error: msgError } = await supabaseAdmin
      .from('peer_messages')
      .select('id')
      .eq('ticket_id', id)
      .eq('media_path', mediaPath)
      .maybeSingle();

    if (msgError) {
      return fail(500, 'QUERY_FAILED', msgError.message);
    }
    if (!msgMatch) {
      return fail(404, 'MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan pada riwayat obrolan tiket ini');
    }

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('session-media')
      .createSignedUrl(mediaPath, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (signError || !signedData?.signedUrl) {
      return fail(500, 'STORAGE_ERROR', signError?.message || 'Gagal menghasilkan signed URL media');
    }

    const responseData: PeerMediaUrlResponse = {
      signed_url: signedData.signedUrl,
      expires_in: SIGNED_URL_EXPIRES_IN_SECONDS,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * POST /api/peer-tickets/[id]/media-url
 * Menghasilkan signed upload URL untuk mengunggah media ke private bucket session-media,
 * atau signed view URL jika action: 'view' dikirimkan via body.
 * Khusus peserta tiket saat sesi aktif (atau claimed khusus relawan) dan jendela 24 jam belum lewat.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'draining') {
      return fail(503, 'MAINTENANCE_DRAINING', 'Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda.');
    }
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticketData) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const ticket = ticketData as PeerTicketEntity;
    const isPatient = user.id === ticket.patient_id;
    const isRelawan = user.id === ticket.claimed_by;
    const isAdmin = user.role === 'admin';

    // Cabang B: Generate Signed View URL via POST jika body menyertakan action 'view' atau path
    const bodyObj = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};
    if (bodyObj.action === 'view' || (typeof bodyObj.path === 'string' && !bodyObj.file_name)) {
      const mediaPath = typeof bodyObj.path === 'string' ? bodyObj.path.trim() : '';
      if (!mediaPath) {
        return fail(400, 'INVALID_PAYLOAD', 'Parameter "path" wajib disertakan');
      }
      if (!isValidPeerMediaPath(id, mediaPath)) {
        return fail(400, 'INVALID_PATH', 'Format path berkas tidak valid');
      }

      if (!isPatient && !isRelawan && !isAdmin) {
        return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat mengakses berkas media ini');
      }

      // Validasi keberadaan berkas: path harus tercatat pada peer_messages tiket tersebut
      const { data: msgMatch, error: msgError } = await supabaseAdmin
        .from('peer_messages')
        .select('id')
        .eq('ticket_id', id)
        .eq('media_path', mediaPath)
        .maybeSingle();

      if (msgError) {
        return fail(500, 'QUERY_FAILED', msgError.message);
      }
      if (!msgMatch) {
        return fail(404, 'MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan pada riwayat obrolan tiket ini');
      }

      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from('session-media')
        .createSignedUrl(mediaPath, SIGNED_URL_EXPIRES_IN_SECONDS);

      if (signError || !signedData?.signedUrl) {
        return fail(500, 'STORAGE_ERROR', signError?.message || 'Gagal menghasilkan signed URL media');
      }

      const viewResponse: PeerMediaUrlResponse = {
        signed_url: signedData.signedUrl,
        expires_in: SIGNED_URL_EXPIRES_IN_SECONDS,
      };

      return NextResponse.json({
        success: true,
        data: viewResponse,
      });
    }

    // Cabang A: Generate Signed Upload URL
    const parsed = peerMediaUploadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(
        422,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Data berkas unggahan tidak valid'
      );
    }

    // Verifikasi status siklus tiket
    if (ticket.status === 'open') {
      return fail(409, 'INVALID_TICKET_STATUS', 'Tiket belum diambil oleh relawan pendamping.');
    }

    if (ticket.status === 'claimed' && isPatient) {
      return fail(409, 'SESSION_NOT_ACTIVE', 'Sesi belum aktif. Menunggu sapaan pertama dari relawan.');
    }

    if (ticket.status !== 'active' && ticket.status !== 'claimed') {
      return fail(409, 'SESSION_NOT_ACTIVE', 'Sesi tiket tidak dalam status aktif.');
    }

    // Verifikasi jendela 24 jam jika tiket sudah berstatus active
    if (ticket.status === 'active' && ticket.first_response_at) {
      const startMs = new Date(ticket.first_response_at).getTime();
      const expireMs = startMs + 24 * 60 * 60 * 1000;
      if (Date.now() > expireMs) {
        return fail(409, 'PEER_SESSION_EXPIRED', 'Waktu sesi pendampingan sebaya telah berakhir (maksimal 24 jam).');
      }
    }

    // Tentukan ekstensi dan susun path penyimpanan berkas
    const rawExt = parsed.data.file_name.split('.').pop()?.toLowerCase() || '';
    const safeExt = /^[a-z0-9]{2,5}$/.test(rawExt)
      ? rawExt
      : (parsed.data.kind === 'image' ? 'jpg' : 'webm');

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filePath = `peer/${id}/${user.id}-${Date.now()}-${randomSuffix}.${safeExt}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('session-media')
      .createSignedUploadUrl(filePath);

    if (uploadError || !uploadData?.signedUrl) {
      return fail(
        500,
        'STORAGE_UPLOAD_ERROR',
        uploadError?.message || 'Gagal menghasilkan URL unggah media'
      );
    }

    const responsePayload: PeerMediaUploadResponse = {
      upload_url: uploadData.signedUrl,
      token: uploadData.token,
      file_path: filePath,
      bucket: 'session-media',
    };

    return NextResponse.json({
      success: true,
      data: responsePayload,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
