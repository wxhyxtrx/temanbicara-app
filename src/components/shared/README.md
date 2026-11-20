# Atomic Design Structure

Komponen-komponen dalam folder ini diorganisir menggunakan metodologi **Atomic Design** yang dikembangkan oleh Brad Frost.

## Struktur Folder

### 🔬 Atoms (`/atoms`)
Komponen paling dasar yang tidak dapat dipecah lagi. Contoh:
- Button
- Input
- Label
- Icon

### 🧪 Molecules (`/molecules`)
Kombinasi dari beberapa atoms yang membentuk komponen yang lebih kompleks. Contoh:
- `FeatureCard` - Kombinasi dari icon, heading, dan text
- `StepCard` - Kombinasi dari number badge, heading, dan description

### 🦠 Organisms (`/organisms`)
Komponen kompleks yang terdiri dari molecules dan atoms. Biasanya merupakan bagian besar dari UI. Contoh:
- `Navbar` - Header navigasi dengan logo, menu, dan button
- `Footer` - Footer dengan links dan informasi

### 📐 Templates (`/templates`)
Kerangka tata letak halaman.

## Komponen Lintas Peran (Pasien, Psikolog, Relawan, Admin)

Dipakai bersama oleh portal semua peran supaya desainnya seragam. Isi per peran diatur lewat props.

| Level | Komponen | Fungsi | Dipakai di |
|---|---|---|---|
| atom | `IconChip` | Kotak ikon berwarna (tone: teal, emerald, sky, amber, rose, violet, slate) | `StatCard`, judul seksi |
| atom | `LoadingState` | Spinner + teks saat memuat (`inline` untuk sebaris) | Tabel admin, ruang sesi, kartu tip/ulasan |
| atom | `StatusBadge` | Badge status booking dari `BOOKING_STATUS_CONFIG` (satu sumber label) | Beranda & ruang psikolog, kartu booking pasien |
| molecule | `PageHeader` | Judul halaman, deskripsi, ikon, slot aksi | Semua halaman non-beranda |
| molecule | `StatCard` | Kartu KPI: label + ikon, angka, satuan, keterangan | Beranda psikolog & relawan |
| molecule | `NoticeBanner` | Banner warning / danger / info dengan aksi | Beranda pasien (kontak darurat) |
| molecule | `EmptyState` | Tampilan "belum ada data" (`compact` / `default`) | Antrean relawan, modal jadwal, beranda |
| molecule | `FilterTabs` | Tombol filter segmented berwarna per status | Payout, sengketa, moderasi ulasan |
| molecule | `TagInput` | Daftar tag + input + saran, dengan batas maksimal | Spesialisasi psikolog, topik relawan |
| organism | `WelcomeHero`, `HeroAction`, `HeroInfoCard` | Hero sambutan bergradien di beranda | Beranda keempat peran |
| template | `PageShell` | Pembungkus konten halaman (jarak, font, warna teks) | Semua halaman portal |

Aturan kontras: tombol berlatar hijau/teal/biru selalu memakai teks putih (`HeroAction`, `FilterTabs`, token `--primary-foreground`).

```tsx
<WelcomeHero
  badge="Portal Psikolog Berlisensi SIPPK"
  title={`Selamat Bertugas, ${nama}`}
  description="..."
  actions={<HeroAction variant="primary" href="/counselor/schedule" icon={<Calendar size={17} />}>Kelola Kalender</HeroAction>}
  aside={<HeroInfoCard title="SIPPK: 123" footer={...}>Psikolog Klinis Terverifikasi</HeroInfoCard>}
/>
```

## Cara Penggunaan

```typescript
// Import dari level yang sesuai
import { Navbar, Footer } from '@/components/shared/organisms';
import { FeatureCard, StepCard } from '@/components/shared/molecules';

// Atau import semua dari index utama
import { Navbar, Footer, FeatureCard, StepCard } from '@/components/shared';
```

## Keuntungan Struktur Ini

1. **Konsistensi** - Komponen diorganisir berdasarkan kompleksitas
2. **Reusability** - Mudah untuk menggunakan kembali komponen
3. **Maintainability** - Mudah untuk menemukan dan memelihara komponen
4. **Scalability** - Struktur yang dapat berkembang seiring waktu

## Panduan Penambahan Komponen Baru

- **Atoms**: Komponen UI dasar yang tidak bergantung pada komponen lain
- **Molecules**: Komponen yang menggunakan 2-5 atoms
- **Organisms**: Komponen besar yang menggunakan molecules dan atoms