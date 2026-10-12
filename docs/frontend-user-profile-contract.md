# Kontrak API Frontend: User & Profil (TemanBicara)

Base URL: `http://localhost:3000` (development)

## Autentikasi

Endpoint yang butuh login membaca token dari salah satu:

| Sumber | Contoh |
|---|---|
| Cookie (otomatis dari `/api/auth/login`) | `tb_access_token=<supabase_access_token>` |
| Header | `Authorization: Bearer <supabase_access_token>` |

Token harus berupa **JWT Supabase yang valid**. UUID user mentah tidak lagi diterima sebagai token.

Dari browser cukup `fetch(url, { credentials: 'include' })`; cookie ikut terkirim otomatis.

## Format error (semua endpoint)

```json
{ "success": false, "error": "UNAUTHENTICATED", "message": "Belum terautentikasi" }
```

| HTTP | `error` | Kapan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `role`/`status` query tidak dikenal (`/api/users`) |
| 400 | `INVALID_ID` | `[id]` bukan UUID |
| 401 | `UNAUTHENTICATED` | Token tidak ada |
| 401 | `INVALID_TOKEN` | Token tidak valid / kedaluwarsa (arahkan ke `/login`) |
| 403 | `FORBIDDEN` | Bukan admin aktif (`/api/users`) |
| 404 | `USER_NOT_FOUND` | Auth valid tapi baris `public.users` tidak ada |
| 404 | `NOT_FOUND` | Psikolog/relawan tidak ada atau belum `active` |
| 500 | `QUERY_FAILED` / `INTERNAL_ERROR` / `SERVER_CONFIG_ERROR` | Kesalahan server |

---

## 1. `GET /api/users/me` (alias: `GET /api/auth/me`)

Data user yang sedang login, plus profil sesuai role. Kedua path mengembalikan respons yang identik.

- **Auth:** wajib
- **Query:** tidak ada

### 200 OK (contoh: psikolog)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "email": "dr.sari@example.com",
      "no_wa": "081234567890",
      "role": "psikolog",
      "status": "active",
      "avatar_url": null,
      "is_email_verified": true,
      "created_at": "2026-10-01T08:00:00Z",
      "updated_at": "2026-10-01T08:00:00Z",
      "fullName": "Sari Wulandari, M.Psi., Psikolog"
    },
    "profile": {
      "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "nama_lengkap_gelar": "Sari Wulandari, M.Psi., Psikolog",
      "nomor_sipp_str": "SIPP-1234/2024",
      "dokumen_sipp_str_url": "dr_sari_example_com/sipp_str-1728641234.pdf",
      "spesialisasi": ["Kecemasan", "Depresi"],
      "tahun_pengalaman": 5,
      "tarif_sesi": 150000,
      "saldo": 450000,
      "verified_at": "2026-10-02T10:00:00Z",
      "rejection_reason": null,
      "created_at": "2026-10-01T08:00:00Z",
      "updated_at": "2026-10-02T10:00:00Z"
    },
    "fullName": "Sari Wulandari, M.Psi., Psikolog"
  }
}
```

Isi `profile` per role:

| role | tabel | field utama |
|---|---|---|
| `pasien` | `pasien_profiles` | `nama_lengkap`, `kontak_darurat_nama`, `kontak_darurat_wa`, `is_anonim_default` |
| `relawan` | `relawan_profiles` | `nama_lengkap`, `latar_belakang`, `dokumen_cv_url`, `alasan_bergabung`, `total_sesi`, `alias_name`, `is_available`, `topik_keahlian`, `rating_rata_rata` |
| `psikolog` | `psikolog_profiles` | `nama_lengkap_gelar`, `nomor_sipp_str`, `dokumen_sipp_str_url`, `spesialisasi`, `tahun_pengalaman`, `tarif_sesi`, `saldo`, `verified_at`, `rejection_reason` |
| `admin` | `admin_profiles` | `nama_lengkap`, `level` |

Catatan:
- `profile` bisa `null` kalau baris profil belum dibuat (misalnya user OAuth yang belum melengkapi data). `fullName` lalu jatuh ke bagian depan email.
- `data.user.fullName` tetap ada supaya `user-store.setAuthSession(json.data.user)` tidak berubah.
- Kolom pasien `kontak_darurat_*`/`is_anonim_default` dan kolom relawan `alias_name`/`is_available`/`topik_keahlian`/`rating_rata_rata` baru muncul setelah `docs/supabase_migration_user_profile.sql` dijalankan. Sebelum itu, perlakukan sebagai `undefined`.
- `numeric` Postgres (`tarif_sesi`, `saldo`) bisa datang sebagai string dari endpoint ini. Bungkus dengan `Number()` sebelum dipakai.

---

## 2. `GET /api/psychologists`

Katalog psikolog untuk beranda pasien. Hanya menampilkan user dengan `status = 'active'`.

- **Auth:** tidak wajib (publik)
- **Query:** `page` (default 1), `limit` (default 12, maks 100)
- **Urutan:** terbaru dulu (`created_at desc`)
- **Tidak pernah dikirim:** `saldo`, `nomor_sipp_str`, `dokumen_sipp_str_url`, `rejection_reason`, `email`, `no_wa`

### 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "nama_lengkap_gelar": "Sari Wulandari, M.Psi., Psikolog",
      "spesialisasi": ["Kecemasan", "Depresi"],
      "tahun_pengalaman": 5,
      "tarif_sesi": 150000,
      "avatar_url": "https://.../avatar.png"
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 1 }
}
```

## 3. `GET /api/psychologists/[id]`

Detail satu psikolog (untuk `PsychologistProfileModal`). `id` = `users.id`. Field-nya sama dengan satu item di katalog.

```json
{ "success": true, "data": { "id": "...", "nama_lengkap_gelar": "...", "spesialisasi": [], "tahun_pengalaman": 5, "tarif_sesi": 150000, "avatar_url": null } }
```

Error: `400 INVALID_ID`, `404 NOT_FOUND` (termasuk psikolog yang belum `active`).

---

## 4. `GET /api/volunteers`

Direktori relawan/pendengar. Hanya menampilkan relawan dengan `status = 'active'`. Privasi dua arah berlaku: identitas asli relawan tidak pernah dikirim.

- **Auth:** tidak wajib (publik)
- **Query:** `page` (default 1), `limit` (default 12, maks 100)
- **Urutan:** `total_sesi desc`
- **Field yang dikirim hanya:** `id`, `alias_name`, `avatar_url`, `topik_keahlian`, `total_sesi`, `rating_rata_rata`, `is_available`
- **Tidak pernah dikirim:** `nama_lengkap`, `no_wa`, `email`, `dokumen_cv_url`, `latar_belakang`, `alasan_bergabung`

Kalau `alias_name` kosong, server mengisinya dengan `"Teman Pendengar XXXX"`. Server tidak pernah memakai nama asli sebagai pengganti.

### 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "1f0c...",
      "alias_name": "Teman Senja",
      "avatar_url": null,
      "topik_keahlian": ["Kesepian", "Hubungan"],
      "total_sesi": 42,
      "rating_rata_rata": 4.8,
      "is_available": true
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 1 }
}
```

## 5. `GET /api/volunteers/[id]`

Detail satu relawan, dengan field yang sama seperti item direktori. Error: `400 INVALID_ID`, `404 NOT_FOUND`.

---

## 6. `GET /api/users` (khusus admin)

Tabel manajemen user di dashboard admin.

- **Auth:** wajib, `role = 'admin'` dengan `status = 'active'`, selain itu `403 FORBIDDEN`
- **Query:**

| param | nilai | default |
|---|---|---|
| `role` | `pasien` \| `relawan` \| `psikolog` \| `admin` | semua |
| `status` | `active` \| `unverified_email` \| `incomplete_profile` \| `pending_approval` \| `pending_verification` \| `rejected` \| `suspended` | semua |
| `search` | cari di email, no_wa, dan nama lengkap (semua tabel profil), tidak peka huruf besar/kecil | - |
| `page` | ≥ 1 | 1 |
| `limit` | 1–100 | 20 |

Contoh: `GET /api/users?role=psikolog&status=pending_verification&search=sari&page=1&limit=20`

### 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "9b1deb4d-...",
      "email": "dr.sari@example.com",
      "no_wa": "081234567890",
      "role": "psikolog",
      "status": "pending_verification",
      "avatar_url": null,
      "is_email_verified": true,
      "created_at": "2026-10-01T08:00:00Z",
      "fullName": "Sari Wulandari, M.Psi., Psikolog",
      "profile": { "nama_lengkap_gelar": "Sari Wulandari, M.Psi., Psikolog", "verified_at": null }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Isi `profile` per role: pasien/relawan `{ nama_lengkap }`, psikolog `{ nama_lengkap_gelar, verified_at }`, admin `{ nama_lengkap, level }`, atau `null`.

---

## TypeScript interfaces (salin ke `src/services/` atau `src/types/`)

```ts
export type ApiRole = 'pasien' | 'relawan' | 'psikolog' | 'admin';
export type ApiAccountStatus =
  | 'active'
  | 'unverified_email'
  | 'incomplete_profile'
  | 'pending_approval'
  | 'pending_verification'
  | 'rejected'
  | 'suspended';

export interface ApiError {
  success: false;
  error: string;
  message: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

// ---------- /api/users/me ----------
export interface MeUser {
  id: string;
  email: string;
  no_wa: string | null;
  role: ApiRole;
  status: ApiAccountStatus;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  updated_at: string;
  fullName: string;
}

export interface PasienProfile {
  user_id: string;
  nama_lengkap: string;
  kontak_darurat_nama?: string | null;
  kontak_darurat_wa?: string | null;
  is_anonim_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelawanProfile {
  user_id: string;
  nama_lengkap: string;
  latar_belakang: string;
  dokumen_cv_url: string;
  alasan_bergabung: string;
  total_sesi: number;
  alias_name?: string | null;
  is_available?: boolean;
  topik_keahlian?: string[];
  rating_rata_rata?: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface PsikologProfile {
  user_id: string;
  nama_lengkap_gelar: string;
  nomor_sipp_str: string;
  dokumen_sipp_str_url: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  tarif_sesi: number | string; // numeric Postgres, gunakan Number()
  saldo: number | string;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  user_id: string;
  nama_lengkap: string;
  level: string;
  created_at: string;
}

export type MeResponse =
  | {
      success: true;
      data: {
        user: MeUser;
        profile: PasienProfile | RelawanProfile | PsikologProfile | AdminProfile | null;
        fullName: string;
      };
    }
  | ApiError;

// ---------- /api/psychologists ----------
export interface PublicPsychologist {
  id: string;
  nama_lengkap_gelar: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  tarif_sesi: number;
  avatar_url: string | null;
}

export type PsychologistListResponse =
  | { success: true; data: PublicPsychologist[]; meta: PageMeta }
  | ApiError;
export type PsychologistDetailResponse = { success: true; data: PublicPsychologist } | ApiError;

// ---------- /api/volunteers ----------
export interface PublicVolunteer {
  id: string;
  alias_name: string;
  avatar_url: string | null;
  topik_keahlian: string[];
  total_sesi: number;
  rating_rata_rata: number | null;
  is_available: boolean;
}

export type VolunteerListResponse =
  | { success: true; data: PublicVolunteer[]; meta: PageMeta }
  | ApiError;
export type VolunteerDetailResponse = { success: true; data: PublicVolunteer } | ApiError;

// ---------- /api/users (admin) ----------
export interface AdminUserRow {
  id: string;
  email: string;
  no_wa: string | null;
  role: ApiRole;
  status: ApiAccountStatus;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  fullName: string;
  profile:
    | { nama_lengkap: string }
    | { nama_lengkap_gelar: string; verified_at: string | null }
    | { nama_lengkap: string; level: string }
    | null;
}

export interface AdminUserQuery {
  role?: ApiRole;
  status?: ApiAccountStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export type AdminUserListResponse =
  | { success: true; data: AdminUserRow[]; meta: PageMeta & { totalPages: number } }
  | ApiError;
```

### Contoh pemakaian

```ts
const res = await fetch('/api/users/me', { credentials: 'include' });
const json: MeResponse = await res.json();
if (!json.success) {
  if (res.status === 401) router.replace('/login');
  return;
}
console.log(json.data.fullName, json.data.user.role);

const qs = new URLSearchParams({ role: 'psikolog', status: 'pending_verification', page: '1' });
const users: AdminUserListResponse = await fetch(`/api/users?${qs}`, { credentials: 'include' }).then((r) => r.json());
```
