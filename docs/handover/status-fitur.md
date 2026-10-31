# Status fitur per halaman (gap list)

Status per 2026-10-30 · dev (setelah Fase 4 & Fase 5). Label:
- **Nyata** = memakai API/DB sungguhan.
- **Tiruan** = data dummy dari store lokal (Zustand mock) — perlu diganti atau disembunyikan.
- **Segera hadir** = sudah diberi label "Coming Soon"/`ComingSoon`, belum ada fungsi.
- **Belum ada** = halaman/fitur belum dibuat.

Kolom "Rencana" merujuk tahap di roadmap (`README.md`): Fase 4, Fase 5, Pelengkap, Rilis.

## Umum / Auth

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Landing, pusat bantuan | Nyata (statis) | — |
| Login (email + Google), register pasien/psikolog/relawan, halaman status akun | Nyata | — |
| Lupa password / reset password | Belum ada | Pelengkap |
| Mode maintenance | Nyata | 4 fase: none, scheduled, draining, active; proteksi middleware, rute guard, banner WIB, bypass cron/webhook/admin/login |

## Admin (`/admin`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda | Nyata + sebagian Segera hadir | statistik dari `admin_dashboard_stats` |
| Pengguna (+ tab verifikasi) | Nyata | `/admin/verifications` hanya redirect ke `/admin/users?tab=verifications` |
| Transaksi (top-up, payout) | Nyata | — |
| Ulasan | Nyata | — |
| Pengaturan sistem + audit | Nyata | — |
| Crisis feed | Segera hadir (`ComingSoon`) | Data tiruan lokal (`useCrisisStore`) telah dibersihkan (PRD-017) |
| Log aktivitas admin | Belum ada | Pelengkap |
| Kelola paket top-up | Belum ada (paket di-hardcode di `patient/top-up/page.tsx`) | Pelengkap |

## Psikolog (`/counselor`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda | Nyata | — |
| Jadwal (mingguan, cuti, jeda) | Nyata | — |
| Ruang Konseling (aktif / riwayat) | Nyata | — |
| Catatan Klien | Nyata | — |
| Pendapatan & payout | Nyata (`MitraEarningsView`) | — |
| Pengaturan profil | Nyata | — |
| Pengaturan → rekening bank pencairan | Segera hadir | Pelengkap (sekarang rekening diisi tiap ajukan payout) |

## Relawan (`/listener`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda | Nyata | profil & statistik rating mitra (`peer_rating_summary`) |
| Antrean tiket curhat (`/listener/queue`) | Nyata | antrean pool, kuota 3/hari, timeout klaim 10m, arsip 24j |
| Ruang Dengar (room 24 jam) (`/listener/peer-room/[id]`) | Nyata | chat realtime, lampiran media gambar & VN, penutupan sesi |
| Pedoman | Nyata (statis) | — |
| Pendapatan (tip) | Nyata (`MitraEarningsView`) | — |
| Pengaturan profil | Nyata | — |
| Pengaturan → preferensi notifikasi antrean | Segera hadir | Pelengkap |

## Pasien (`/patient`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda — booking, saldo, kontak darurat | Nyata | — |
| Beranda — "Curhat AI Instan (24/7)" | Dihapus | dihapus dari UI beranda |
| Beranda — curhat sebaya | Nyata | form curhat sebaya, kartu status tiket aktif, kartu empati tiket kedaluwarsa |
| `/patient/room` | Dihapus | rute telah dihapus dan dialihkan ke `/patient/beranda` |
| `/patient/peer-room/[id]` | Nyata | Ruang Dengar sebaya untuk pasien: chat realtime, lampiran media gambar & VN, penutupan sesi, rating 1–5, tip koin via `tip_create` |
| Cari & booking psikolog | Nyata | — |
| Jadwal (mendatang / riwayat) | Nyata | — |
| Ruang sesi `/patient/session/[id]` | Nyata | — |
| Top-up & riwayat transaksi | Nyata | — |
| Pengaturan profil + anonimitas + kontak darurat | Nyata | — |
| Pengaturan → Notifikasi sesi | Segera hadir (`useNotificationStore` mock) | Pelengkap |
| Pengaturan → Keamanan akun (ganti password) | Nyata | Selesai dibangun (PRD-001 & PRD-002) untuk pasien & psikolog |
| Pengaturan → Keamanan akun (2FA) | Segera hadir | Pelengkap |
| Pengaturan → Ekspor PDF | Segera hadir | Pelengkap |

## Utang teknis

| Item | Rencana |
| --- | --- |
| `/api/auth/refresh` memakai client `supabasePublic` bersama → jadikan per-request | Pelengkap |
| Kolom legacy `psikolog_profiles.saldo` & enum legacy → drop | Pelengkap |
| Pembersihan 6 mock store (`chat-store`, `peer-vent-store`, `crisis-store`, `review-store`, `schedule-store`, `clinical-records-store`) | Selesai dibersihkan (PRD-017) |
| Supabase produksi baru, env Vercel lengkap, uji keamanan manual (Postman) | Rilis |
