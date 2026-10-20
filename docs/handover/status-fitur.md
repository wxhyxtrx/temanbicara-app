# Status fitur per halaman (gap list)

Status per 2026-10-20 · master/dev `758296a`. Label:
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
| Mode maintenance | Belum ada (kunci `maintenance` ada di settings, belum ditegakkan) | Fase 4 (middleware) |

## Admin (`/admin`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda | Nyata + sebagian Segera hadir | statistik dari `admin_dashboard_stats` |
| Pengguna (+ tab verifikasi) | Nyata | `/admin/verifications` hanya redirect ke `/admin/users?tab=verifications` |
| Transaksi (top-up, payout) | Nyata | — |
| Ulasan | Nyata | — |
| Pengaturan sistem + audit | Nyata | — |
| Crisis feed | **Tiruan** (`useCrisisStore`) | Fase 5 / sembunyikan sebelum Rilis |
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
| Beranda | Nyata (profil) + antrean Segera hadir | Fase 5 |
| Antrean tiket curhat | Segera hadir (`ComingSoon`) | Fase 5 |
| Ruang Dengar (room 24 jam) | Belum ada | Fase 5 |
| Pedoman | Nyata (statis) | — |
| Pendapatan (tip) | Nyata (`MitraEarningsView`) | — |
| Pengaturan profil | Nyata | — |
| Pengaturan → preferensi notifikasi antrean | Segera hadir | Pelengkap |

## Pasien (`/patient`)

| Halaman | Status | Catatan / Rencana |
| --- | --- | --- |
| Beranda — booking, saldo, kontak darurat | Nyata | — |
| Beranda — "Curhat AI Instan (24/7)" | **Tiruan** | belum dijadwalkan; sembunyikan sebelum Rilis |
| Beranda — curhat sebaya (`usePeerVentStore`) | **Tiruan** | Fase 5 |
| `/patient/room` (UI chat AI/sebaya lama, `useChatStore`) | **Tiruan** — bukan ruang sesi psikolog | Fase 5 / hapus |
| Cari & booking psikolog | Nyata | — |
| Jadwal (mendatang / riwayat) | Nyata | — |
| Ruang sesi `/patient/session/[id]` | Nyata | — |
| Top-up & riwayat transaksi | Nyata | — |
| Pengaturan profil + anonimitas + kontak darurat | Nyata | — |
| Pengaturan → Notifikasi sesi | Segera hadir (`useNotificationStore` mock) | Pelengkap |
| Pengaturan → Keamanan akun (ganti password, 2FA) | Segera hadir | Pelengkap |
| Pengaturan → Ekspor PDF | Segera hadir | Pelengkap |

## Utang teknis

| Item | Rencana |
| --- | --- |
| `/api/auth/refresh` memakai client `supabasePublic` bersama → jadikan per-request | Pelengkap |
| Kolom legacy `psikolog_profiles.saldo` & enum legacy → drop | Pelengkap |
| Hapus sisa store tiruan (`useCrisisStore`, `usePeerVentStore`, `useChatStore`, `useNotificationStore`) setelah penggantinya ada | Fase 5 / Pelengkap |
| Supabase produksi baru, env Vercel lengkap, uji keamanan manual (Postman) | Rilis |
