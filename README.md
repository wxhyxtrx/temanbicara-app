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

- **Framework:** Next.js 15 (App Router, Turbopack, Route Handlers sebagai API)
- **Backend & Autentikasi:** Supabase (Auth, Database, Google OAuth)
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
│   ├── api/                # Route handlers (auth, users, psychologists, volunteers, upload)
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
├── constant/               # Data statis, konfigurasi menu peran, dan tipe peran
├── hooks/                  # Custom React hooks
├── lib/                    # Klien Supabase, validasi, dan fungsi utilitas
├── services/               # Pemanggil API sisi klien
├── store/                  # Store Zustand untuk autentikasi dan preferensi sesi
├── types/                  # Definisi tipe TypeScript
└── middleware.ts           # Proteksi rute berdasarkan sesi dan peran
```

## Pemberitahuan Status Pengembangan

> **Akun demo dan tombol Quick Demo sudah dihapus.** Seluruh autentikasi kini berjalan melalui Supabase, sehingga akun demo lama (`*@temanbicara.id` / `password123`) tidak lagi berlaku.

**Sudah terhubung ke backend (Supabase):**
- Login email & kata sandi serta masuk dengan Google (OAuth).
- Registrasi terpisah untuk Pasien, Psikolog, dan Relawan (`/api/auth/register/*`).
- Status akun: akun yang ditangguhkan atau ditolak diarahkan ke halaman status, bukan diblokir saat login.
- Profil pengguna (`/api/users/me`) serta direktori psikolog dan relawan.
- Manajemen pengguna oleh Administrator (CRUD, ubah status akun, filter) dengan perlindungan agar admin tidak menghapus akunnya sendiri.
- Logout otomatis ketika sesi kedaluwarsa (respons 401).

**Masih menggunakan data statis (belum terhubung ke backend):**
- Ruang chat dan panggilan sesi.
- Jadwal sesi, dompet koin, top-up, dan pembayaran.
- Pendapatan konselor (earnings), crisis feed, dan audit transaksi.

**Catatan akun:**
- Akun Pasien, Psikolog, dan Relawan dibuat melalui halaman register. Akun Psikolog dan Relawan memerlukan verifikasi Administrator.
- Akun Administrator tidak dapat didaftarkan melalui halaman register dan harus dibuat langsung di proyek Supabase.

## Memulai Pengembangan

### Prasyarat
- Node.js versi 20 atau yang lebih baru
- npm, pnpm, atau yarn

### Langkah Instalasi

1. Clone repositori ini:
   ```bash
   git clone https://github.com/wxhyxtrx/temanbicara-app.git
   cd temanbicara-app
   ```

2. Pasang dependensi proyek:
   ```bash
   npm install
   ```

3. Salin `.env.example` menjadi `.env.local` (`cp .env.example .env.local`), lalu isi minimal kredensial Supabase berikut:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=   # hanya dipakai di server, jangan diekspos ke klien
   ```
   Untuk login Google, aktifkan provider Google di Supabase dan tambahkan `http://localhost:3000/api/auth/oauth/google/callback` ke daftar Redirect URL.

4. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```

5. Buka peramban di [http://localhost:3000](http://localhost:3000).

### Build Produksi

Untuk memvalidasi dan mengompilasi aplikasi ke versi produksi:
```bash
npm run build
npm run start
```

