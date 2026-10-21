import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { createPeerTicketSchema } from '@/lib/validations/peer-tickets';
import type { PeerTicketEntity } from '@/types/peer-tickets';

/**
 * POST /api/peer-tickets
 * Membuat tiket curhat sebaya baru (khusus pasien aktif).
 */
export async function POST(req: Request) {
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

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran pasien yang dapat membuat tiket curhat');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pasien belum aktif');
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

    const parsed = createPeerTicketSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data input tidak valid');
    }

    const { data: ticket, error: rpcError } = await supabaseAdmin.rpc('peer_ticket_create', {
      p_patient_id: user.id,
      p_alias: parsed.data.patient_alias,
      p_topic: parsed.data.topic,
      p_emotion: parsed.data.emotion,
      p_content: parsed.data.content,
      p_is_anon: parsed.data.is_anonymous ?? true,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('ACTIVE_TICKET_EXISTS')) {
        return fail(409, 'ACTIVE_TICKET_EXISTS', 'Pasien masih memiliki tiket curhat yang sedang aktif.');
      }
      if (msg.includes('FORBIDDEN_ROLE')) {
        return fail(403, 'FORBIDDEN_ROLE', 'Hanya pasien aktif yang dapat membuat tiket curhat');
      }
      if (msg.includes('INVALID_PARAMETER')) {
        return fail(422, 'INVALID_PARAMETER', 'Parameter tiket curhat tidak valid');
      }
      return fail(400, 'CREATE_TICKET_FAILED', msg || 'Gagal membuat tiket curhat');
    }

    return NextResponse.json(
      {
        success: true,
        data: ticket as PeerTicketEntity,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
