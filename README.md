# TemanBicara

Platform konseling dan kesehatan mental. Pasien bisa memesan sesi dengan psikolog, berbagi cerita dengan relawan pendengar sebaya, dan admin memantau seluruh platform.

🔗 **[Demo live](https://temanbicara-app-eight.vercel.app)**

## ✨ Fitur Utama

- **Multi-peran:** Pasien, Psikolog, Relawan Pendengar Sebaya, dan Admin, masing-masing dengan akses dan dashboard sendiri
- **Booking sesi:** pilih jadwal, lakukan reschedule, dan batalkan sesi
- **Chat sesi:** pesan teks, gambar, dan pesan suara dalam satu ruang sesi
- **Koin dan pencairan:** dompet koin, tip, dan pengajuan pencairan honor untuk mitra
- **Dashboard admin:** verifikasi mitra, pemantauan sesi berjalan, dan feed alarm krisis
- **Pengingat:** notifikasi pengingat sesi dan antrean curhat untuk relawan

## 🧰 Tech Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · Supabase (PostgreSQL + RLS) · Zod · Vercel

## 🔐 Keamanan

- Autentikasi memakai cookie HttpOnly dan JWT Supabase yang diverifikasi di server
- Row Level Security di database, dan akses service role hanya dari server
- Validasi input di server dengan Zod, dan pesan error tidak membocorkan detail database
- Pembayaran memakai Midtrans sandbox (belum mode produksi)

## ⚙️ Menjalankan Secara Lokal

```bash
git clone https://github.com/wxhyxtrx/temanbicara-app.git
cd temanbicara-app
npm install
cp .env.example .env.local   # isi variabel Supabase
npm run dev
```

## 🚧 Status

Dalam pengembangan. Beberapa fitur belum tersedia: ekspor PDF, autentikasi dua faktor (2FA), dan pengingat via WhatsApp.
