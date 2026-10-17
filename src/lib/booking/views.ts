import type { BookingEntity, BookingStatus, ExtensionStatus, PsikologBookingView } from '@/types/booking';

/**
 * Helper untuk menyaring record booking agar sesuai dengan batas privasi psikolog.
 * Review Focus #5 & Task B4/B7:
 * Psikolog TIDAK PERNAH menerima nama_lengkap, email, no_wa, kontak darurat, atau data identitas asli pasien.
 * Hanya patient_display_name snapshot yang disertakan.
 */
export function toPsikologBookingView(booking: BookingEntity | Record<string, unknown>): PsikologBookingView {
  return {
    id: String(booking.id),
    start_at: String(booking.start_at),
    status: booking.status as BookingStatus,
    keluhan: String(booking.keluhan),
    patient_display_name: String(booking.patient_display_name || 'Pasien Anonim'),
    price_coins: Number(booking.price_coins),
    extension_status: (booking.extension_status as ExtensionStatus | null) ?? null,
    extension_price_coins: booking.extension_price_coins !== null && booking.extension_price_coins !== undefined
      ? Number(booking.extension_price_coins)
      : null,
    extension_coins: booking.extension_coins !== null && booking.extension_coins !== undefined
      ? Number(booking.extension_coins)
      : null,
    ended_at: (booking.ended_at as string | null) ?? null,
    created_at: String(booking.created_at),
    updated_at: String(booking.updated_at),
  };
}
