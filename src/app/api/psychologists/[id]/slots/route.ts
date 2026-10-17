import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail } from '@/lib/auth/session';
import { activeProfiles } from '@/lib/public-profiles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/psychologists/[id]/slots?from=YYYY-MM-DD&days=7
 * Endpoint publik untuk melihat daftar slot konseling tersedia milik seorang psikolog.
 * Query Parameters:
 * - from: tanggal awal kalender (format YYYY-MM-DD, default: hari ini WIB)
 * - days: jumlah hari ke depan (integer 1..14, default: 7)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const daysParam = url.searchParams.get('days');

    // Default 'from' adalah hari ini dalam zona waktu WIB (Asia/Jakarta)
    let fromStr = fromParam;
    if (!fromStr) {
      fromStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    } else if (!DATE_RE.test(fromStr)) {
      return fail(422, 'VALIDATION_ERROR', 'Format parameter from harus berupa YYYY-MM-DD');
    }

    // Validasi parsed date
    const parsedFrom = new Date(`${fromStr}T00:00:00+07:00`);
    if (Number.isNaN(parsedFrom.getTime())) {
      return fail(422, 'VALIDATION_ERROR', 'Tanggal from tidak valid');
    }

    // Default 'days' = 7, maksimal 14
    let daysNum = 7;
    if (daysParam !== null) {
      const parsedDays = Number(daysParam);
      if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 14) {
        return fail(422, 'VALIDATION_ERROR', 'Parameter days harus berupa bilangan bulat antara 1 dan 14');
      }
      daysNum = parsedDays;
    }

    // 1. Cek apakah psikolog ada dan berstatus active
    const { data: psychologist, error: psychError } = await activeProfiles('psikolog_profiles')
      .eq('user_id', id)
      .maybeSingle();

    if (psychError) {
      return fail(500, 'QUERY_FAILED', psychError.message);
    }
    if (!psychologist) {
      return fail(404, 'NOT_FOUND', 'Psikolog tidak ditemukan');
    }

    // 2. Hitung rentang ISO timestamp WIB
    const fromIso = `${fromStr}T00:00:00+07:00`;
    const toDate = new Date(parsedFrom.getTime() + daysNum * 24 * 60 * 60 * 1000);
    const toIso = toDate.toISOString();

    // 3. Panggil RPC generator slot
    const { data: slots, error: rpcError } = await supabaseAdmin.rpc('psikolog_available_slots', {
      p_psikolog_id: id,
      p_from: fromIso,
      p_to: toIso,
    });

    if (rpcError) {
      return fail(500, 'FETCH_SLOTS_FAILED', rpcError.message);
    }

    const slotList: string[] = Array.isArray(slots) ? (slots as string[]) : [];

    return NextResponse.json({
      success: true,
      data: {
        slots: slotList,
      },
      slots: slotList,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
