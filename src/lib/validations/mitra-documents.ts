import { supabaseAdmin } from '@/lib/supabase/client';
import { sanitizeEmailPrefix, buildDocumentKeyRegex } from './auth';

export type MitraDocType = 'sipp_str' | 'cv';
export type MitraDocTable = 'psikolog_profiles' | 'relawan_profiles';
export type MitraDocColumn = 'dokumen_sipp_str_url' | 'dokumen_cv_url';

export type ValidateMitraDocumentResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validasi kepemilikan dan integritas berkas dokumen registrasi mitra:
 * 1. Key bukan URL penuh (http:// atau https://).
 * 2. Key cocok regex ^<prefix_email>/(<docType>)-[a-f0-9-]{36}\.pdf$.
 * 3. File benar-benar ada di bucket storage 'dokumen-mitra'.
 * 4. Key belum pernah digunakan oleh profil mitra lain di database.
 */
export async function validateMitraDocument(
  email: string,
  key: string,
  docType: MitraDocType,
  table: MitraDocTable,
  column: MitraDocColumn
): Promise<ValidateMitraDocumentResult> {
  if (!email || typeof email !== 'string') {
    return { ok: false, reason: 'Alamat email wajib diisi.' };
  }

  if (!key || typeof key !== 'string') {
    return { ok: false, reason: 'Kunci dokumen wajib diisi.' };
  }

  const trimmedKey = key.trim();

  // 1. Tolak URL penuh (bukan key mentah)
  if (trimmedKey.startsWith('http://') || trimmedKey.startsWith('https://')) {
    return {
      ok: false,
      reason: 'URL penuh tidak diizinkan. Gunakan path kunci dokumen mentah.',
    };
  }

  // 2. Cek format regex & prefix email (mencegah path traversal, pemakaian prefix email lain, dan tipe dokumen tertukar)
  const prefix = sanitizeEmailPrefix(email);
  const regex = buildDocumentKeyRegex(prefix, docType);

  if (!regex.test(trimmedKey)) {
    return {
      ok: false,
      reason: 'Format dokumen tidak valid atau dokumen bukan milik akun pendaftar.',
    };
  }

  // 3. Verifikasi file ada di bucket storage 'dokumen-mitra'
  const fileName = trimmedKey.slice(prefix.length + 1);

  if (!supabaseAdmin) {
    console.error('[validateMitraDocument] supabaseAdmin client tidak tersedia');
    return {
      ok: false,
      reason: 'Gagal memverifikasi dokumen di penyimpanan. Layanan tidak tersedia.',
    };
  }

  const { data: files, error: listError } = await supabaseAdmin.storage
    .from('dokumen-mitra')
    .list(prefix);

  if (listError) {
    console.error('[validateMitraDocument] Storage list error:', listError);
    return {
      ok: false,
      reason: 'Gagal memverifikasi dokumen di penyimpanan. Silakan coba kembali.',
    };
  }

  const fileExists = Array.isArray(files) && files.some((f) => f.name === fileName);
  if (!fileExists) {
    return {
      ok: false,
      reason: 'Dokumen belum diunggah atau tidak ditemukan di penyimpanan.',
    };
  }

  // 4. Verifikasi key belum dipakai profil lain di tabel terkait
  const { data: existingDoc, error: queryError } = await supabaseAdmin
    .from(table)
    .select('user_id')
    .eq(column, trimmedKey)
    .limit(1)
    .maybeSingle();

  if (queryError) {
    console.error('[validateMitraDocument] Database check error:', queryError);
    return {
      ok: false,
      reason: 'Gagal memverifikasi keunikan dokumen di sistem. Silakan coba kembali.',
    };
  }

  if (existingDoc) {
    return {
      ok: false,
      reason: 'Dokumen ini sudah pernah digunakan oleh profil lain.',
    };
  }

  return { ok: true };
}

/**
 * Self-test assert-based murni untuk pengujian offline format regex kunci dokumen mitra.
 * Membuktikan 4 kasus penolakan (URL penuh, path traversal, document_type tertukar, prefix email lain)
 * serta kasus positif.
 */
export function runMitraDocumentRegexSelfTest(): { passed: boolean; casesChecked: number } {
  const email = 'dr.budi@gmail.com';
  const prefix = sanitizeEmailPrefix(email);
  const sippRegex = buildDocumentKeyRegex(prefix, 'sipp_str');
  const cvRegex = buildDocumentKeyRegex(prefix, 'cv');

  const validSippKey = `${prefix}/sipp_str-12345678-1234-1234-1234-123456789abc.pdf`;
  const validCvKey = `${prefix}/cv-12345678-1234-1234-1234-123456789abc.pdf`;

  let casesChecked = 0;

  // Kasus Positif: format valid
  if (!sippRegex.test(validSippKey)) throw new Error('SelfTest failed: Valid SIPP key ditolak');
  if (!cvRegex.test(validCvKey)) throw new Error('SelfTest failed: Valid CV key ditolak');
  casesChecked += 2;

  // Kasus 1: Tolak URL penuh
  const fullUrl1 = `https://supabase.co/storage/v1/object/public/dokumen-mitra/${validSippKey}`;
  const fullUrl2 = `http://localhost:54321/storage/v1/object/public/dokumen-mitra/${validCvKey}`;
  if (sippRegex.test(fullUrl1)) throw new Error('SelfTest failed: URL penuh https seharusnya ditolak');
  if (cvRegex.test(fullUrl2)) throw new Error('SelfTest failed: URL penuh http seharusnya ditolak');
  casesChecked += 2;

  // Kasus 2: Tolak path traversal
  const traversal1 = `../../${validSippKey}`;
  const traversal2 = `${prefix}/../../sipp_str-12345678-1234-1234-1234-123456789abc.pdf`;
  const traversal3 = `${prefix}/sipp_str-../1234-1234-1234-123456789abc.pdf`;
  if (sippRegex.test(traversal1)) throw new Error('SelfTest failed: Path traversal 1 seharusnya ditolak');
  if (sippRegex.test(traversal2)) throw new Error('SelfTest failed: Path traversal 2 seharusnya ditolak');
  if (sippRegex.test(traversal3)) throw new Error('SelfTest failed: Path traversal 3 seharusnya ditolak');
  casesChecked += 3;

  // Kasus 3: Tolak document_type tertukar
  if (sippRegex.test(validCvKey)) throw new Error('SelfTest failed: CV key seharusnya ditolak untuk regex sipp_str');
  if (cvRegex.test(validSippKey)) throw new Error('SelfTest failed: SIPP key seharusnya ditolak untuk regex cv');
  casesChecked += 2;

  // Kasus 4: Tolak prefix email lain
  const otherPrefix = sanitizeEmailPrefix('dr.andi@gmail.com');
  const otherEmailKey = `${otherPrefix}/sipp_str-12345678-1234-1234-1234-123456789abc.pdf`;
  if (sippRegex.test(otherEmailKey)) throw new Error('SelfTest failed: Prefix email lain seharusnya ditolak');
  casesChecked += 1;

  return { passed: true, casesChecked };
}

/* @self-test — T-204 validasi dokumen registrasi mitra (manual; ponytail: upgrade ke test runner bila proyek memasangnya)
 *
 * 1. Tolak URL penuh:
 *    key = 'https://supabase.co/storage/v1/object/public/dokumen-mitra/dr_budi_gmail_com/sipp_str-12345678-1234-1234-1234-123456789abc.pdf'
 *    buildDocumentKeyRegex('dr_budi_gmail_com', 'sipp_str').test(key) === false
 * 2. Tolak path traversal:
 *    key = 'dr_budi_gmail_com/../../sipp_str-12345678-1234-1234-1234-123456789abc.pdf'
 *    buildDocumentKeyRegex('dr_budi_gmail_com', 'sipp_str').test(key) === false
 * 3. Tolak document_type tertukar:
 *    key = 'dr_budi_gmail_com/cv-12345678-1234-1234-1234-123456789abc.pdf'
 *    buildDocumentKeyRegex('dr_budi_gmail_com', 'sipp_str').test(key) === false
 * 4. Tolak prefix email lain:
 *    key = 'dr_andi_gmail_com/sipp_str-12345678-1234-1234-1234-123456789abc.pdf' (email: dr.budi@gmail.com)
 *    buildDocumentKeyRegex(sanitizeEmailPrefix('dr.budi@gmail.com'), 'sipp_str').test(key) === false
 * 5. Terima key valid:
 *    key = 'dr_budi_gmail_com/sipp_str-12345678-1234-1234-1234-123456789abc.pdf'
 *    buildDocumentKeyRegex('dr_budi_gmail_com', 'sipp_str').test(key) === true
 */
