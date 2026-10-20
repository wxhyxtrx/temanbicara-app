# Fase 3 — Booking & Sesi Psikolog (Rancangan)

Status: DRAFT untuk disetujui Bang Wahyu · 2026-10-17
Lokasi: docs/ (tidak masuk git)

Label: **[Wahyu]** = diputuskan Bang Wahyu · **[Claude]** = keputusan konsultan, boleh dikoreksi · **[Lama]** = aturan yang sudah disepakati sebelumnya (memori/pengaturan sistem)

---

## 1. Tujuan

Pasien bisa mencari psikolog, memesan slot jadwal dengan koin, bertemu di ruang chat sesi, lalu memberi rating/ulasan/tip. Psikolog bisa mengatur jadwal praktik, menjalankan sesi, dan menulis catatan klien. Ini fitur inti TemanBicara; seluruh uang mengalir lewat sistem koin & ledger yang sudah ada (Fase 2).

**Sukses =** satu perjalanan penuh berjalan dengan data asli: pasien top-up → booking → sesi chat → selesai → psikolog dapat honor (holding 48 jam) → pasien bisa baca riwayat & booking ulang.

**Bukan tujuan Fase 3 (non-goals):** video/voice call, sesi grup, booking berulang otomatis, psikolog menerima/menolak booking, kompensasi koin bonus, template klinis (SOAP/diagnosis), notifikasi email/WA (cukup notifikasi di aplikasi).

**Gagal walau "jalan" (anti-goals):**
- Dua pasien mendapat slot yang sama.
- Koin pasien terpotong tapi booking tidak tercatat (atau sebaliknya).
- Catatan klien bisa dibaca selain psikolog penulisnya.
- Angka uang di UI tidak cocok dengan ledger.

## 2. Aturan yang sudah ada (dipakai apa adanya)

- 1 koin = Rp 10.000. Dompet pasien = koin; saldo mitra = rupiah. **[Lama]**
- Bagi hasil dari `system_settings.revenue_share.mitra_bps` (saat ini 8500 = 85%). Snapshot ke booking. **[Lama]**
- Pendapatan mitra masuk `mitra_earnings` dengan holding `holding.hours` (48 jam), dirilis cron yang sudah ada. **[Lama]**
- Ledger append-only; semua mutasi uang lewat RPC SECURITY DEFINER (`SET search_path=''`). **[Lama]**
- Kredit boleh ke akun non-aktif; debit wajib akun aktif. **[Lama]**
- Pengaturan dipakai: `refund_policy`, `psikolog_late` (10 mnt), `patient_noshow` (30 mnt), `extension_price` (1–10 koin), `tip` (5–50, cap harian 100), `upload` (media 10MB, VN 180 dtk), `media_retention` (30 hari). **[Lama]**
- Tabel `tips` sudah ada (source_type 'session', unik per sumber). **[Lama]**
- Semua waktu **WIB**. **[Claude]**

## 3. Jadwal psikolog (gaya Halodoc) **[Wahyu: setuju pola Halodoc]**

- **Pola mingguan**: per hari, satu atau beberapa rentang jam (mis. Senin 19.00–21.00; Rabu 09.00–12.00 & 19.00–21.00).
- Sistem memecah jadi **slot 60 menit**, mulai di jam bulat. (60 = 45 sesi + 10 ekstensi + 3 lebih + 2 penutupan **[Lama]**.) Rentang wajib di jam bulat. **[Claude]**
- **Libur/pengecualian**: psikolog menandai tanggal (seharian atau rentang jam) sebagai libur → slot hilang.
- **Batas booking**: paling cepat 2 jam sebelum mulai, paling jauh 14 hari ke depan. Kedua angka jadi pengaturan admin baru. **[Claude]**
- Mengubah pola/menambah libur **tidak membatalkan** booking yang sudah ada. Jika libur menimpa booking, UI memperingatkan psikolog bahwa booking itu harus dibatalkan manual (berlaku aturan pembatalan psikolog). **[Claude]**
- Tombol **"Jeda terima booking"**: slot disembunyikan dari pasien; booking yang ada tetap jalan.
- Slot yang ditampilkan ke pasien = slot pola − libur − sudah dibooking − sudah lewat/terlalu dekat.

## 4. Booking (pasien) **[Wahyu: booking langsung pasti, tanpa persetujuan psikolog]**

Alur: daftar psikolog (label keahlian, rating, harga) → profil → pilih tanggal & jam → isi keluhan → "Bayar & Booking".

- **Keluhan wajib** diisi (min 20, maks 1000 karakter). **[Claude]**
- **Harga** = `tarif_sesi / 10000` koin (tarif psikolog dalam rupiah, kelipatan 10.000). Disnapshot ke booking: `price_coins`, `mitra_share_bps`, `extension_price_coins`, `refund_policy`. **[Lama: snapshot]**
- **Atomik**: ambil slot + potong koin dalam **satu RPC**. Berhasil semua atau batal semua.
- **Bentrok**: satu slot hanya satu booking aktif, dikunci di DB (unique index psikolog+waktu mulai untuk status aktif). Yang kalah dapat pesan "Slot baru saja dipesan orang lain" dan **koin tidak terpotong**. Tidak ada "tahan slot" saat mengisi keluhan. **[Wahyu setuju]**
- **Anti-spam**: maks **3 booking aktif** per pasien; maks **1 booking per psikolog per hari** per pasien. Angka jadi pengaturan admin. **[Wahyu setuju]**
- Psikolog yang statusnya tidak aktif, sedang jeda, atau sedang kena suspensi strike tidak bisa dibooking.

## 5. Pembatalan & pindah jadwal

### 5a. Oleh pasien
- **Batal**: refund sesuai `refund_policy` snapshot (saat ini: ≥60 mnt sebelum = 100%, 30–60 mnt = 65% dibulatkan ke atas, <30 mnt = 0%). Sisa koin yang tidak di-refund dibagi mitra/platform sesuai `mitra_share_bps` (masuk `mitra_earnings` source 'refund_share'). **[Lama]**
- **Pindah jadwal sendiri**: gratis, **maks 1 kali per booking**, hanya jika **>24 jam** sebelum sesi, ke slot **psikolog yang sama**. <24 jam = hanya bisa batal. **[Wahyu setuju usulan]**

### 5b. Oleh psikolog **[Wahyu: refund 100% + penalti; pasien boleh pilih pindah jadwal]**
- Pasien dapat notifikasi dengan 2 pilihan: **pindah ke slot lain psikolog yang sama** (koin dipindah, tanpa bayar lagi) atau **refund 100%**.
- Jika pasien tidak memilih dalam 48 jam atau sampai jam sesi asli lewat → otomatis refund. **[Claude]**
- **Penalti = strike** (bukan denda uang): **[Wahyu setuju]**
  - batal >24 jam sebelum: 0 strike
  - batal <24 jam sebelum: 1 strike
  - tidak muncul (lewat `psikolog_late`): 2 strike, refund 100% otomatis
  - **3 strike dalam 30 hari** → booking psikolog otomatis ditutup **7 hari** + notifikasi admin
  - strike kedaluwarsa 30 hari; angka-angka jadi pengaturan admin
  - publik melihat "Tingkat kehadiran N%" di profil psikolog; admin melihat detail strike di detail pengguna. **[Claude]**

## 6. Ruang sesi (chat)

- Ruang dibuka untuk kedua pihak **10 menit sebelum** jam mulai (pasien bisa masuk & menunggu). **[Claude]**
- Chat realtime (Supabase Realtime). Teks, gambar (≤10MB), voice note (≤180 dtk). Media dihapus 30 hari setelah ruang tutup; teks disimpan selama akun aktif. **[Lama]**
- Keluhan pasien tampil di atas ruang untuk psikolog.
- Durasi **45 menit** dihitung dari jam mulai slot (bukan dari pesan pertama). **[Claude, mengikuti hard cap Lama]**
- **Psikolog telat**: jika belum mengirim pesan dalam `psikolog_late` menit → sesi batal otomatis, refund 100%, 2 strike. Psikolog yang telat (tapi masih dalam toleransi) **kehilangan hak ekstensi**. **[Lama]**
- **Pasien no-show**: tidak ada pesan pasien dalam `patient_noshow` menit setelah pesan pertama psikolog → sesi selesai sebagai no-show pasien: **refund 0%, seluruh koin dibakar dan dibagi mitra/platform sesuai `mitra_share_bps`** (sama seperti sesi selesai). Pasien yang datang terlambat tidak me-reset timer, hanya mendapat sisa waktu. **[Lama — system-settings-spec.md]**
- **Ekstensi 10 menit**: diajukan pasien, wajib disetujui psikolog, koin `extension_price_coins` dipotong di muka; tombol nonaktif jika saldo kurang atau sudah tidak muat sebelum hard cap. Maks 1 ekstensi. **[Lama + Claude: maks 1]**
- **Harga ekstensi**: diatur psikolog di Pengaturan, dalam rentang admin `extension_price` (1–10 koin). **[Claude, memakai rentang admin yang sudah ada]**
- **Hard cap**: ruang tutup paksa di menit ke-58 dari jam mulai. **[Lama]**
- **Mengakhiri**: psikolog menekan "Akhiri sesi" (setelah berpamitan); otomatis di hard cap. Pasien tidak perlu konfirmasi. **[Wahyu: psikolog minta izin lalu mengakhiri; mekanisme tombol = Claude]**
- Setelah selesai, ruang menjadi **riwayat read-only** untuk kedua pihak, dengan tombol "Booking lagi" untuk pasien. **[Wahyu]**

## 7. Uang **[Lama + Claude]**

- Saat booking: koin pasien didebit (ledger, ref ke booking). Koin "tertahan" di booking sampai hasil akhir.
- Sesi selesai normal: `price_coins × 10000 × mitra_share_bps/10000` → `mitra_earnings` (source 'session', holding 48 jam); sisanya → platform_revenue.
- Ekstensi: sama, source 'extension'.
- Refund: kredit koin ke pasien (ledger, ref ke booking).
- Semua transisi status booking + uang dalam RPC yang sama (atomik, idempoten; pakai constraint unik ledger/earnings yang ada).
- Waktu (telat, no-show, hard cap, auto-refund) dijalankan pg_cron tiap menit + dicek ulang saat ada aksi, sehingga tidak bergantung pada browser terbuka. **[Claude]**

## 8. Catatan klien **[Wahyu: versi sederhana di Fase 3]**

- Satu catatan teks bebas per booking, ditulis psikolog selama/sesudah sesi.
- Saat pasien yang sama booking lagi, psikolog melihat daftar catatan sesi-sesi sebelumnya dengan pasien itu.
- **Hanya psikolog penulis** yang bisa membaca/mengubah — dikunci RLS + API; pasien, psikolog lain, dan admin tidak bisa. **[Claude]**
- Template klinis (SOAP, diagnosis) → nanti.

## 8b. Identitas pasien yang dilihat psikolog **[Wahyu setuju]**

- Psikolog selalu melihat **nama panggilan** pasien (fallback: kata pertama nama lengkap). Nama lengkap, email, dan nomor WA pasien **tidak** dikirim ke psikolog.
- Jika pasien mengaktifkan **anonim** (`is_anonim_default`), psikolog hanya melihat "Pasien Anonim" (+ kode pendek booking agar bisa membedakan). Pilihan ini disnapshot ke booking saat dibuat.
- **Kontak darurat** tidak terlihat oleh psikolog; hanya admin yang bisa membukanya untuk kondisi krisis (akses dicatat di audit). **[Claude]**
- Berlaku di semua tempat: daftar booking psikolog, ruang sesi, catatan klien, notifikasi.

## 9. Rating, ulasan, tip **[Wahyu + Claude]**

- Hanya untuk booking yang **selesai normal**. Satu booking = maks satu rating & satu tip.
- Rating 1–5 opsional; **tidak diisi = tidak dihitung**. **[Wahyu]**
- Jendela 7 hari setelah sesi (dari layar akhir sesi atau riwayat); rating/ulasan bisa diubah selama 7 hari. **[Claude]**
- Rata-rata ditampilkan setelah ≥3 rating; sebelumnya "Psikolog baru". **[Claude]**
- **Ulasan teks publik** di profil psikolog, **tanpa nama pasien** (tampil "Pasien · Okt 2026"). Maks 500 karakter, peringatan "jangan tulis info pribadi". Admin bisa menyembunyikan; psikolog bisa melaporkan. **[Wahyu: publik; moderasi = Claude]**
- **Tip**: sesuai pengaturan `tip` (min/maks/cap harian), bagi hasil & holding seperti sesi, pakai tabel `tips` yang ada. Psikolog dapat notifikasi, nama pasien anonim. **[Lama + Claude]**

## 10. Notifikasi (di aplikasi saja) **[Claude]**

Booking baru (psikolog), pengingat 1 jam & 10 menit sebelum sesi (keduanya), pembatalan (pihak lain), pilihan pindah/refund (pasien), sesi dimulai, tip diterima (psikolog), strike & suspensi (psikolog, admin).

## 11. Pengaturan admin baru **[Claude]**

- `booking`: min_hours_before (2), max_days_ahead (14), max_active_per_patient (3), max_per_psikolog_per_day (1), reschedule_min_hours (24), psikolog_cancel_free_hours (24), choice_deadline_hours (48).
- `strike`: per_late_cancel (1), per_noshow (2), threshold (3), window_days (30), suspend_days (7).
- `rating`: window_days (7), min_count_to_show (3).

## 12. Data (gambaran, detail ke Paul)

- `psikolog_schedules` (pola mingguan), `psikolog_time_off` (libur), kolom jeda + harga ekstensi di profil psikolog.
- `bookings` (pasien, psikolog, start_at, status, keluhan, snapshot harga/bagi hasil/refund_policy/harga ekstensi, reschedule_count, info ekstensi, hasil akhir).
- `session_messages` (+ media di bucket private).
- `client_notes`, `session_reviews`, `psikolog_strikes`, `notifications`.
- Status booking, mengikuti system-settings-spec.md **[Lama]**: `booked → in_progress → completed`, atau berakhir di `cancelled_by_patient` / `auto_cancelled_late` (psikolog telat) / `no_show` (pasien). Ditambah untuk Fase 3 **[Claude]**: `cancelled_by_psikolog` dan `awaiting_patient_choice` (setelah psikolog batal, menunggu pasien pilih pindah/refund).

## 13. Diserahkan ke builder

Skema tabel & index persis, nama RPC, struktur realtime channel, desain UI detail (mengikuti gaya yang ada; UI lama counselor schedule/room/clients ada di riwayat git sebelum 0d12f1e), urutan pemecahan tugas (<100 langkah per tugas; BE dulu per bagian, dry-run tiap migrasi, lalu FE).

## 14. Pertanyaan terbuka

Tidak ada. No-show pasien sudah ditentukan di spesifikasi awal (refund 0%); identitas pasien disetujui 2026-10-17.
