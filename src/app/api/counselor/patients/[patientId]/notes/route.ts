import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { ClientNoteDetail, ClientNoteEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/counselor/patients/[patientId]/notes
 * Mengambil seluruh riwayat catatan klinis yang pernah ditulis psikolog ini untuk pasien tertentu.
 * Data diurutkan dari yang terbaru.
 * Review Focus #5: Bebas dari data pribadi (hanya menyertakan patient_display_name).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
    if (!UUID_RE.test(patientId)) {
      return fail(400, 'INVALID_ID', 'ID pasien tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat mengakses catatan pasien');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // 1. Ambil nama display pasien terbaru dari booking terakhir psikolog ini dengan pasien tsb
    const { data: latestBooking } = await supabaseAdmin
      .from('bookings')
      .select('patient_display_name, start_at')
      .eq('psikolog_id', user.id)
      .eq('patient_id', patientId)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let patientDisplayName = latestBooking?.patient_display_name;

    // Jika belum ada snapshot booking (fallback aman tanpa membocorkan identitas)
    if (!patientDisplayName) {
      const { data: patientProfile } = await supabaseAdmin
        .from('pasien_profiles')
        .select('nama_panggilan, nama_lengkap, is_anonim_default')
        .eq('user_id', patientId)
        .maybeSingle();

      if (!patientProfile || patientProfile.is_anonim_default) {
        patientDisplayName = 'Pasien Anonim';
      } else if (patientProfile.nama_panggilan && patientProfile.nama_panggilan.trim().length > 0) {
        patientDisplayName = patientProfile.nama_panggilan.trim();
      } else if (patientProfile.nama_lengkap && patientProfile.nama_lengkap.trim().length > 0) {
        patientDisplayName = patientProfile.nama_lengkap.trim().split(' ')[0];
      } else {
        patientDisplayName = 'Pasien Anonim';
      }
    }

    // 2. Ambil catatan klinis psikolog ini untuk pasien ini (urut terbaru)
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('client_notes')
      .select('booking_id, psikolog_id, patient_id, body, created_at, updated_at')
      .eq('psikolog_id', user.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (notesError) {
      return fail(500, 'QUERY_FAILED', notesError.message);
    }

    const noteRows = (notes || []) as ClientNoteEntity[];

    // 3. Ambil start_at & snapshot display name tiap booking untuk melengkapi konteks waktu sesi
    const bookingIds = noteRows.map((n) => n.booking_id);
    const bookingMetaMap = new Map<string, { start_at: string; patient_display_name: string }>();

    if (bookingIds.length > 0) {
      const { data: bookingsData } = await supabaseAdmin
        .from('bookings')
        .select('id, start_at, patient_display_name')
        .in('id', bookingIds);

      for (const b of bookingsData || []) {
        bookingMetaMap.set(b.id, {
          start_at: b.start_at,
          patient_display_name: b.patient_display_name,
        });
      }
    }

    const detailedNotes: ClientNoteDetail[] = noteRows.map((n) => {
      const meta = bookingMetaMap.get(n.booking_id);
      return {
        ...n,
        start_at: meta?.start_at ?? null,
        patient_display_name: meta?.patient_display_name || patientDisplayName,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        patient_id: patientId,
        patient_display_name: patientDisplayName,
        notes: detailedNotes,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
