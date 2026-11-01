import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail } from '@/lib/auth/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat menghapus waktu libur');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID waktu libur tidak valid');
    }

    // Pastikan hanya pemilik waktu libur yang dapat menghapusnya
    const { data: existing, error: findError } = await supabaseAdmin
      .from('psikolog_time_off')
      .select('id')
      .eq('id', id)
      .eq('psikolog_id', session.user.id)
      .maybeSingle();

    if (findError) {
      console.error('[COUNSELOR_TIME_OFF_FIND_ERROR]:', findError);
      return fail(500, 'QUERY_FAILED', 'Gagal mencari data waktu libur');
    }
    if (!existing) {
      return fail(404, 'NOT_FOUND', 'Waktu libur tidak ditemukan');
    }

    const { error: deleteError } = await supabaseAdmin
      .from('psikolog_time_off')
      .delete()
      .eq('id', id)
      .eq('psikolog_id', session.user.id);

    if (deleteError) {
      console.error('[COUNSELOR_TIME_OFF_DELETE_ERROR]:', deleteError);
      return fail(500, 'DELETE_TIME_OFF_FAILED', 'Gagal menghapus waktu libur');
    }

    return NextResponse.json({
      success: true,
      message: 'Waktu libur berhasil dihapus',
    });
  } catch (err: unknown) {
    console.error('[COUNSELOR_TIME_OFF_DELETE_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat menghapus waktu libur');
  }
}
