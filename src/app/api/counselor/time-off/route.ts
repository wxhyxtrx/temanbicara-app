import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail } from '@/lib/auth/session';
import { createTimeOffSchema } from '@/lib/validations/schedule';

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat menambahkan waktu libur');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(422, 'VALIDATION_ERROR', 'Format JSON tidak valid atau body kosong');
    }

    const parsed = createTimeOffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Validasi waktu libur gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { start_at, end_at, reason } = parsed.data;

    // 1. Simpan Waktu Libur ke Database
    const { data: newTimeOff, error: insertError } = await supabaseAdmin
      .from('psikolog_time_off')
      .insert({
        psikolog_id: session.user.id,
        start_at,
        end_at,
        reason: reason ?? null,
      })
      .select('id, start_at, end_at, reason, created_at')
      .single();

    if (insertError || !newTimeOff) {
      return fail(500, 'CREATE_TIME_OFF_FAILED', insertError?.message ?? 'Gagal menyimpan waktu libur');
    }

    // 2. Deteksi Booking yang Tertimpa (Conflicting Bookings)
    // Tabel bookings dibuat di Task B4; tangani gracefully jika tabel belum ada.
    let conflictingBookings: { id: string; start_at: string }[] = [];
    try {
      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from('bookings')
        .select('id, start_at')
        .eq('psikolog_id', session.user.id)
        .in('status', ['booked', 'in_progress'])
        .gte('start_at', start_at)
        .lt('start_at', end_at);

      if (!conflictError && conflicts) {
        conflictingBookings = conflicts;
      }
    } catch {
      conflictingBookings = [];
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Waktu libur berhasil ditambahkan',
        data: {
          ...newTimeOff,
          conflicting_bookings: conflictingBookings,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
