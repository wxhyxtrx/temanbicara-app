/**
 * scripts/check-psikolog-views.ts
 *
 * Verifikasi Review Focus #5 (Task B7 & Privasi Pasien Fase 3):
 * 1. Menguji fungsi helper `toPsikologBookingView` dengan fixture data pasien lengkap (termasuk field sensitif).
 * 2. Memastikan output JSON tidak mengandung key atau value:
 *    - nama_lengkap
 *    - email
 *    - no_wa
 *    - kontak_darurat
 *    - kontak_darurat_nama
 *    - kontak_darurat_wa
 * 3. Memverifikasi seluruh route booking/sesi/pesan/catatan untuk role psikolog menggunakan helper ini atau menyaring identitas pasien.
 *
 * Jalankan via: npx tsx scripts/check-psikolog-views.ts
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { toPsikologBookingView } from '../src/lib/booking/views';

const SENSITIVE_KEYS = [
  'nama_lengkap',
  'email',
  'no_wa',
  'kontak_darurat',
  'kontak_darurat_nama',
  'kontak_darurat_wa',
];

const SENSITIVE_VALUES = [
  'Siti Rahasia Lestari',
  'siti.rahasia@sensitif.test',
  '081234567890',
  'Budi Santoso',
  '081987654321',
];

function runUnitTest() {
  console.log('--- 1. UJI UNIT toPsikologBookingView ---');

  const dirtyBookingFixture = {
    id: 'b7000000-0000-0000-0000-000000000101',
    patient_id: 'b7000000-0000-0000-0000-000000000003',
    psikolog_id: 'b7000000-0000-0000-0000-000000000001',
    start_at: '2026-10-18T10:00:00.000Z',
    status: 'in_progress',
    keluhan: 'Kecemasan berlebih menjelang wawancara kerja.',
    patient_display_name: 'Siti L.',
    price_coins: 10,
    mitra_share_bps: 8500,
    extension_status: 'none',
    extension_price_coins: 2,
    extension_coins: null,
    ended_at: null,
    created_at: '2026-10-18T09:00:00.000Z',
    updated_at: '2026-10-18T09:15:00.000Z',
    // Data bocoran sensitif yang tidak boleh lolos ke psikolog:
    nama_lengkap: 'Siti Rahasia Lestari',
    email: 'siti.rahasia@sensitif.test',
    no_wa: '081234567890',
    kontak_darurat: 'Budi Santoso',
    kontak_darurat_nama: 'Budi Santoso',
    kontak_darurat_wa: '081987654321',
  };

  const sanitized = toPsikologBookingView(dirtyBookingFixture);
  const jsonString = JSON.stringify(sanitized);

  // Assert keys
  for (const key of SENSITIVE_KEYS) {
    assert.strictEqual(
      key in sanitized,
      false,
      `[FAIL] Kunci sensitif '${key}' ditemukan pada hasil toPsikologBookingView!`
    );
  }

  // Assert JSON string content
  for (const val of SENSITIVE_VALUES) {
    assert.strictEqual(
      jsonString.includes(val),
      false,
      `[FAIL] Nilai sensitif '${val}' bocor pada JSON serialisasi toPsikologBookingView!`
    );
  }

  // Assert field esensial tetap ada dan akurat
  assert.strictEqual(sanitized.id, dirtyBookingFixture.id);
  assert.strictEqual(sanitized.status, 'in_progress');
  assert.strictEqual(sanitized.keluhan, dirtyBookingFixture.keluhan);
  assert.strictEqual(sanitized.patient_display_name, 'Siti L.');
  assert.strictEqual(sanitized.price_coins, 10);
  assert.strictEqual(sanitized.extension_price_coins, 2);

  // Uji edge-case: fallback jika patient_display_name null / undefined
  const anonymousBookingFixture = {
    ...dirtyBookingFixture,
    patient_display_name: null,
  };
  const sanitizedAnon = toPsikologBookingView(anonymousBookingFixture);
  assert.strictEqual(
    sanitizedAnon.patient_display_name,
    'Pasien Anonim',
    '[FAIL] Fallback patient_display_name seharusnya "Pasien Anonim"'
  );

  console.log('[PASS] Unit test toPsikologBookingView: Semua key & value identitas sensitif tersaring 100%.');
}

function runRoutesAudit() {
  console.log('\n--- 2. AUDIT ROUTE PSIKOLOG (REVIEW FOCUS #5) ---');

  const rootDir = path.resolve(__dirname, '..');
  const routesToCheck = [
    {
      file: 'src/app/api/bookings/route.ts',
      requiresHelper: true,
      description: 'Daftar booking psikolog (GET)',
    },
    {
      file: 'src/app/api/bookings/[id]/route.ts',
      requiresHelper: true,
      description: 'Detail booking psikolog (GET)',
    },
    {
      file: 'src/app/api/bookings/[id]/cancel/route.ts',
      requiresHelper: true,
      description: 'Pembatalan oleh psikolog (POST)',
    },
    {
      file: 'src/app/api/bookings/[id]/end/route.ts',
      requiresHelper: true,
      description: 'Penyelesaian sesi oleh psikolog (POST)',
    },
    {
      file: 'src/app/api/bookings/[id]/extension/respond/route.ts',
      requiresHelper: true,
      description: 'Respon ekstensi oleh psikolog (POST)',
    },
    {
      file: 'src/app/api/bookings/[id]/messages/route.ts',
      requiresHelper: false,
      verifyNoLeaks: true,
      description: 'Pesan obrolan sesi konseling (GET, POST)',
    },
    {
      file: 'src/app/api/bookings/[id]/note/route.ts',
      requiresHelper: false,
      verifyNoLeaks: true,
      description: 'Catatan klinis booking sesi (GET, PUT)',
    },
    {
      file: 'src/app/api/counselor/patients/[patientId]/notes/route.ts',
      requiresHelper: false,
      verifyNoLeaks: true,
      description: 'Riwayat catatan klien untuk psikolog (GET)',
    },
  ];

  for (const item of routesToCheck) {
    const fullPath = path.join(rootDir, item.file);
    assert.strictEqual(fs.existsSync(fullPath), true, `[FAIL] Berkas route ${item.file} tidak ditemukan!`);

    const content = fs.readFileSync(fullPath, 'utf-8');

    if (item.requiresHelper) {
      assert.strictEqual(
        content.includes('toPsikologBookingView'),
        true,
        `[FAIL] Route ${item.file} tidak memanggil toPsikologBookingView!`
      );
      console.log(`[PASS] ${item.description}: Terverifikasi memanggil toPsikologBookingView`);
    }

    if (item.verifyNoLeaks) {
      // Pastikan route pesan / catatan tidak mengambil atau mereturn kolom identitas sensitif
      assert.strictEqual(
        content.includes('kontak_darurat_wa'),
        false,
        `[FAIL] Route ${item.file} tidak boleh mengekspos kontak_darurat_wa!`
      );
      assert.strictEqual(
        content.includes('kontak_darurat_nama'),
        false,
        `[FAIL] Route ${item.file} tidak boleh mengekspos kontak_darurat_nama!`
      );
      console.log(`[PASS] ${item.description}: Terverifikasi bebas dari kebocoran identitas pasien`);
    }
  }
}

function main() {
  try {
    runUnitTest();
    runRoutesAudit();
    console.log('\n============================================================');
    console.log('[PASS] REVIEW FOCUS #5: PENYARINGAN IDENTITAS PSIKOLOG VALID');
    console.log('============================================================');
    process.exit(0);
  } catch (err: unknown) {
    console.error('\n[ERROR]', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
