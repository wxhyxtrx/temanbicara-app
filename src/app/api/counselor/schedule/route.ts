import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail } from '@/lib/auth/session';
import { updateScheduleSchema } from '@/lib/validations/schedule';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat mengakses jadwal praktik');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // 1. Ambil Pola Mingguan
    const { data: weekly, error: weeklyError } = await supabaseAdmin
      .from('psikolog_schedules')
      .select('id, weekday, start_hour, end_hour')
      .eq('psikolog_id', session.user.id)
      .order('weekday', { ascending: true })
      .order('start_hour', { ascending: true });

    if (weeklyError) {
      return fail(500, 'FETCH_SCHEDULE_FAILED', weeklyError.message);
    }

    // 2. Ambil Waktu Libur (Time Off)
    const { data: timeOff, error: timeOffError } = await supabaseAdmin
      .from('psikolog_time_off')
      .select('id, start_at, end_at, reason, created_at')
      .eq('psikolog_id', session.user.id)
      .order('start_at', { ascending: true });

    if (timeOffError) {
      return fail(500, 'FETCH_TIME_OFF_FAILED', timeOffError.message);
    }

    // 3. Ambil Konfigurasi Booking Profil Psikolog
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('psikolog_profiles')
      .select('booking_paused, extension_price_coins, suspended_until')
      .eq('user_id', session.user.id)
      .single();

    if (profileError) {
      return fail(500, 'FETCH_PROFILE_FAILED', profileError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        weekly: weekly ?? [],
        time_off: timeOff ?? [],
        booking_paused: Boolean(profile?.booking_paused),
        extension_price_coins: profile?.extension_price_coins ?? null,
        suspended_until: profile?.suspended_until ?? null,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat mengatur jadwal praktik');
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

    const parsed = updateScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Validasi jadwal gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { weekly } = parsed.data;

    // Ganti seluruh baris jadwal pola milik psikolog ini
    const { error: deleteError } = await supabaseAdmin
      .from('psikolog_schedules')
      .delete()
      .eq('psikolog_id', session.user.id);

    if (deleteError) {
      return fail(500, 'UPDATE_SCHEDULE_FAILED', deleteError.message);
    }

    if (weekly.length > 0) {
      const recordsToInsert = weekly.map((slot) => ({
        psikolog_id: session.user.id,
        weekday: slot.weekday,
        start_hour: slot.start_hour,
        end_hour: slot.end_hour,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('psikolog_schedules')
        .insert(recordsToInsert);

      if (insertError) {
        return fail(500, 'UPDATE_SCHEDULE_FAILED', insertError.message);
      }
    }

    // Ambil hasil tersimpan terbaru
    const { data: updatedWeekly, error: fetchError } = await supabaseAdmin
      .from('psikolog_schedules')
      .select('id, weekday, start_hour, end_hour')
      .eq('psikolog_id', session.user.id)
      .order('weekday', { ascending: true })
      .order('start_hour', { ascending: true });

    if (fetchError) {
      return fail(500, 'FETCH_SCHEDULE_FAILED', fetchError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Pola jadwal mingguan berhasil diperbarui',
      data: {
        weekly: updatedWeekly ?? [],
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
