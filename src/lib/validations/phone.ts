/**
 * Normalisasi nomor telepon/WhatsApp ke format baku 628xx.
 * Menghapus spasi, strip, tanda plus, kurung, dan mengubah awalan '08' / '+628' / '628' menjadi '628xx'.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.trim().replace(/[\s\-()+]/g, '');
  if (cleaned.startsWith('62')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return `62${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('8')) {
    return `62${cleaned}`;
  }
  return cleaned;
}
