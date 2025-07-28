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