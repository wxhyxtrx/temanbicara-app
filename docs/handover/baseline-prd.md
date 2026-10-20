# PRD-000 — Baseline TemanBicara (fitur yang SUDAH ada)

Status per 2026-10-20 · master/dev `758296a` · disusun SA (pengawas-temanbicara).

Dokumen ini adalah "PRD lama" untuk tim: daftar fitur yang sudah dibangun dan diterima Bos. PRD baru **tidak boleh** membangun ulang hal di sini; kalau mau mengubahnya, tulis sebagai PRD perubahan yang merujuk bagian terkait. Aturan bisnis rinci ada di `README.md` bagian 2; model data di `sdd.md`; apa yang kurang di `status-fitur.md`.

## Ringkasan produk

TemanBicara = aplikasi telekonseling kesehatan mental. Pasien membeli **koin** (1 koin = Rp 10.000) lalu memesan sesi chat 45 menit dengan **psikolog** berlisensi; psikolog dibayar dalam rupiah (80%). **Relawan** (pendengar sebaya, gratis) dan **admin** juga punya portal. Bahasa UI Indonesia, waktu WIB.

## Tahap yang sudah selesai

| Tahap | Isi utama yang sudah jalan |
| --- | --- |
| 0. Fondasi | Registrasi pasien / psikolog / relawan (dokumen SIPP/STR atau CV, PDF ≤ 5 MB), login email + Google, verifikasi mitra oleh admin, status akun (pending, aktif, ditolak, ditangguhkan), cookie role bertanda tangan, landing page & pusat bantuan |
| 1. Pengaturan sistem | Admin mengatur semua angka bisnis (koin, refund, strike, payout, tip, upload, retensi media, booking, rating) dalam tab Keuangan / Sesi / Relawan / Sistem; riwayat audit perubahan |
| 2. Dompet | Top-up koin via Midtrans Snap (sandbox) + webhook + cek status + kedaluwarsa otomatis; riwayat top-up & transaksi; ledger append-only; pendapatan mitra ditahan 48 jam lalu cair; payout mitra diajukan, admin tandai dibayar/tolak |
| 3. Rapikan admin & pasien | Beranda admin dengan statistik nyata; kelola pengguna (saldo, detail, dokumen, ubah status, tambah pengguna); paginasi & filter seragam |
| 4. Rapikan psikolog & relawan | Halaman mitra memakai data nyata atau label "Segera hadir"; pengaturan profil psikolog (kontak, spesialisasi, pengalaman, tarif sesi, harga ekstensi) & relawan (alias, topik); kontak darurat pasien |
| 5. Fase 3 — booking & sesi | Lihat bawah |

## Fase 3 — booking & sesi psikolog (selesai 2026-10-20)

**Psikolog**
- Jadwal mingguan (jam per hari, WIB) + cuti (tanggal/jam) + jeda terima booking.
- Beranda: janji temu mendatang, batal dengan peringatan strike, ulasan masuk + "Laporkan ulasan", label "Disembunyikan admin".
- Ruang Konseling: tab Sesi Aktif / Riwayat; chat realtime (teks, gambar, voice note ≤ 3 menit), timer 45 menit, setujui/tolak ekstensi 10 menit, "Akhiri sesi", panel catatan klien (hanya penulisnya yang bisa membaca).
- Catatan Klien: daftar pasien (nama panggilan saja) → riwayat catatan per sesi.
- Kena strike bila batal mendadak / tidak hadir; 3 poin dalam 30 hari = suspensi 7 hari.

**Pasien**
- Cari psikolog (rating ≥ 3 ulasan, kehadiran %, tarif, ulasan anonim), pilih slot 14 hari ke depan, isi keluhan, bayar koin.
- Jadwal: Mendatang / Riwayat; batal (refund 100% / 65% / 0% sesuai waktu), pindah jadwal 1x (> 24 jam), pilih refund atau pindah bila psikolog batal.
- Ruang sesi: chat realtime, ajukan ekstensi, hanya-baca setelah selesai.
- Setelah sesi: rating 1–5 + ulasan (edit 7 hari), tip 1–50 koin (1x per sesi), "Booking lagi".
- Banner "Lengkapi kontak darurat" bila belum diisi.

**Admin**
- Menu "Ulasan": kartu ringkasan global, filter dilaporkan/disembunyikan/semua, sembunyikan/tampilkan.
- Detail psikolog: ringkasan strike 30 hari & status suspensi.
- Akses kontak darurat pasien tercatat di log.

**Otomatis (server)**
- Cron tiap menit: pengingat 60 & 10 menit, batal otomatis bila psikolog tidak menyapa 10 menit (refund 100% + 2 strike), no-show pasien 30 menit (refund 0%), tutup paksa menit 58, refund otomatis bila pasien tidak memilih setelah psikolog batal.
- Notifikasi in-app realtime (lonceng) untuk semua kejadian di atas.
- Media sesi dihapus otomatis 30 hari setelah sesi (Vercel Cron 02.00 WIB).
- Sesi login diperpanjang otomatis (refresh token); logout membersihkan semua cookie.

## Di luar baseline (belum dibangun)

Lihat `status-fitur.md`. Ringkas: Fase 4 mode maintenance, Fase 5 relawan & curhat sebaya (antrean tiket, Ruang Dengar), backlog Pelengkap (ganti password, 2FA, rekening bank psikolog, preferensi notifikasi, ekspor PDF, log aktivitas admin, paket top-up), Curhat AI, Crisis feed admin (masih data tiruan), lalu Rilis produksi.
