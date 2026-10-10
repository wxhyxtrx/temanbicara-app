# TemanBicara

TemanBicara adalah aplikasi web layanan kesehatan mental dan konseling terstruktur. Aplikasi ini menghubungkan pengguna dengan psikolog klinis profesional, relawan pendengar sebaya (peer listener), serta asisten refleksi emosi berbasis Psychological First Aid (PFA) dalam lingkungan komunikasi yang terenkripsi dan anonim.

Platform ini mengadopsi arsitektur multi-peran dengan alur kerja terpisah untuk pasien, konselor, pendengar sebaya, dan administrator.

## Peran Pengguna

TemanBicara membagi hak akses dan fungsionalitas ke dalam empat portal kerja:

### 1. Pasien (Patient)
- Konsultasi privat bersama psikolog klinis berlisensi (SIPPK/STR).
- Sesi curhat cepat dengan relawan pendengar sebaya atau asisten AI PFA.
- Pemantauan suasana hati harian (Emotion Check-in) dan panduan relaksasi pernapasan 4-7-8.
- Pengaturan identitas anonim untuk melindungi privasi selama sesi berlangsung.
- Pengelolaan dompet koin untuk penjadwalan sesi konseling.

### 2. Konselor (Counselor)
- Kalender penjadwalan dan alokasi slot konsultasi mandiri.
- Manajemen rekam konsultasi dan riwayat sesi klien.
- Ruang sesi konsultasi privat dengan media chat terintegrasi.
- Dasbor rekonsiliasi pendapatan dan penarikan koin honorarium.

### 3. Pendengar Sebaya (Peer Listener)
- Penanganan antrean curhat anonim berbasis Psychological First Aid.
- Lembar panduan etika mendengarkan aktif dan mitigasi risiko percakapan.
- Pemantauan status ketersediaan (online, sibuk, offline).

### 4. Administrator
- Verifikasi berkas legalitas dan nomor surat izin praktik psikolog (SIPPK).
- Pemantauan laporan eskalasi krisis (Crisis Feed) untuk rujukan darurat.
- Audit arus transaksi koin dan verifikasi top-up saldo pasien.
- Pengelolaan status dan hak akses akun pengguna.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Bahasa:** TypeScript
- **Styling:** Tailwind CSS v4, Shadcn UI (Radix UI primitives)
- **Ikon:** Lucide React, React Icons
- **State Management:** Zustand (penyimpanan state persisten dan sinkronisasi role)
- **Validasi & Formulir:** React Hook Form, Zod
- **Tanggal & Notifikasi:** Date-fns, Sonner

## Struktur Proyek

```text
src/
├── app/
│   ├── (auth)/             # Halaman autentikasi (login, register)
│   ├── (private)/          # Portal aplikasi terlindungi
│   │   ├── admin/          # Dasbor, verifikasi, audit transaksi, crisis feed
│   │   ├── counselor/      # Dasbor konselor, jadwal slot, klien, earnings
│   │   ├── listener/       # Dasbor pendengar, antrean curhat, panduan PFA
│   │   └── patient/        # Beranda pasien, ruang chat, jadwal, top-up koin
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page publik
├── components/
│   ├── shared/             # Komponen bersama (layouts, navigasi, sidebar dinamis)
│   ├── ui/                 # Primitif UI (Shadcn/Radix UI)
│   └── views/              # Komponen modular per tampilan halaman
├── constant/               # Data statis, konfigurasi menu peran, dan mock users
├── hooks/                  # Custom React hooks
├── lib/                    # Fungsi pembantu dan konfigurasi utilitas
└── store/                  # Store Zustand untuk autentikasi dan preferensi sesi
```

## Akun Demo Pengujian

Aplikasi menyediakan tombol Quick Demo pada halaman login untuk menguji alur kerja setiap peran tanpa konfigurasi database tambahan:

| Peran | Email | Kata Sandi | Keterangan |
| :--- | :--- | :--- | :--- |
| Pasien | `wahyu@temanbicara.id` | `password123` | Saldo awal 50 koin |
| Konselor | `anita@temanbicara.id` | `password123` | Psikolog Klinis Dewasa (SIPPK terverifikasi) |
| Peer Listener | `rian@temanbicara.id` | `password123` | Relawan terlatih PFA |
| Administrator | `admin@temanbicara.id` | `password123` | Hak akses pengawasan platform |

## Memulai Pengembangan

### Prasyarat
- Node.js versi 20 atau yang lebih baru
- npm, pnpm, atau yarn

### Langkah Instalasi

1. Clone repositori ini:
   ```bash
   git clone https://github.com/wxhyxtrx/temanbicara-app.git
   cd temanbicara
   ```

2. Pasang dependensi proyek:
   ```bash
   npm install
   ```

3. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```

4. Buka peramban di [http://localhost:3000](http://localhost:3000).

### Build Produksi

Untuk memvalidasi dan mengompilasi aplikasi ke versi produksi:
```bash
npm run build
npm run start
```

