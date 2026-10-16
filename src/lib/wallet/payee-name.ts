/**
 * Normalisasi nama untuk pencocokan rekening bank:
 * 1. Ambil bagian sebelum koma (buang gelar belakang seperti ", M.Psi", ", S.Psi, Psikolog", ", Sp.KJ").
 * 2. Buang gelar depan umum (Dr., dr., Drs., Dra., Prof., dsb.).
 * 3. Buang singkatan gelar belakang jika ditulis tanpa koma di ujung nama.
 * 4. Buang tanda baca, ubah huruf kecil, dan normalisasi spasi menjadi spasi tunggal.
 */
export function normalizePayeeName(name: string): string {
  if (!name) return '';

  // 1. Ambil teks sebelum koma pertama (gelar belakang umumnya setelah koma)
  let clean = name.split(',')[0] ?? '';

  // 2. Buang gelar depan berulang (misal "Prof. Dr. ...", "dr. ...", "Dra. ...")
  clean = clean.replace(/^(?:(?:prof|dr|drs|dra)\.?\s+)+/gi, '');

  // 3. Buang singkatan gelar belakang jika ditulis tanpa koma
  clean = clean.replace(/\b(?:m\.?psi(?:\.?\s*psikolog)?|s\.?psi|sp\.?kj|m\.?sc|ph\.?d|s\.?ked|s\.?sos|m\.?kes|psikolog)\b/gi, '');

  // 4. Hapus karakter non-alfanumerik (kecuali spasi), ubah ke huruf kecil, normalisasi spasi
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
