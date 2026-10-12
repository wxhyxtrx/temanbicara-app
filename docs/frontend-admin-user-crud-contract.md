# Kontrak API: Admin User Management (TemanBicara)

Modul ini mendokumentasikan spesifikasi CRUD lengkap dan kapabilitas filter untuk manajemen pengguna pada portal Admin TemanBicara (`/admin/users`).

---

## 1. Ikhtisar Keamanan & Otorisasi

- **Role Wajib:** `admin` dengan `status = 'active'`.
- **Autentikasi:** Membaca token dari Cookie `tb_access_token` atau Header `Authorization: Bearer <token>`.
- **Proteksi Khusus (Self-Protection Guard):**
  - Admin **DILARANG** mengubah status akunnya sendiri menjadi tidak aktif (`suspended`, `rejected`, dll).
  - Admin **DILARANG** mendemosi peran akunnya sendiri dari `admin`.
  - Admin **DILARANG** menghapus akunnya sendiri (mencegah lockout permanen).

---

## 2. Daftar Endpoint CRUD

| Method | Endpoint | Deskripsi | Akses |
|---|---|---|---|
| `GET` | `/api/users` | Ambil daftar pengguna (filter `role`, `status`, `search`, pagination) | Admin |
| `POST` | `/api/users` | Tambah pengguna baru secara manual | Admin |
| `GET` | `/api/users/[id]` | Ambil detail 1 pengguna beserta data profil per role | Admin |
| `PATCH` | `/api/users/[id]` | Perbarui data akun / profil pengguna | Admin |
| `PATCH` | `/api/users/[id]/status` | Shortcut perbarui status akun pengguna | Admin |
| `DELETE` | `/api/users/[id]` | Hapus pengguna permanen dari DB dan Supabase Auth | Admin |

---

## 3. Spesifikasi Detail Endpoint

### A. `GET /api/users` (Daftar Pengguna & Filter)

#### Query Parameters:
- `role` (opsional): `'pasien' | 'relawan' | 'psikolog' | 'admin'`
- `status` (opsional): `'active' | 'unverified_email' | 'incomplete_profile' | 'pending_approval' | 'pending_verification' | 'rejected' | 'suspended'`
- `search` (opsional): kata kunci pencarian (mencocokkan nama lengkap di 4 tabel profil, email, dan no WA)
- `page` (opsional, default: `1`): nomor halaman
- `limit` (opsional, default: `20`): jumlah data per halaman

#### Contoh Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "e4f8c2b1-91a3-4882-93cb-129381283812",
      "email": "user@temanbicara.id",
      "no_wa": "081234567890",
      "role": "pasien",
      "status": "active",
      "avatar_url": null,
      "is_email_verified": true,
      "created_at": "2026-10-10T12:00:00Z",
      "fullName": "Wahyu Tricahyo",
      "profile": {
        "nama_lengkap": "Wahyu Tricahyo"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### B. `POST /api/users` (Tambah Pengguna Baru)

#### Request Body:
```json
{
  "email": "dr.maya@temanbicara.id",
  "password": "Password123!",
  "role": "psikolog",
  "fullName": "Dr. Maya Indah, M.Psi., Psikolog",
  "no_wa": "081299887766",
  "status": "active",
  "nomor_sipp_str": "SIPP-2026-0912",
  "tarif_sesi": 150000
}
```

#### Catatan Eksekusi Server:
- Server otomatis membuat akun di Supabase Auth (`email_confirm: true`), memasukkan ke `public.users`, dan mengisikan tabel profil anak (`psikolog_profiles`, `relawan_profiles`, `pasien_profiles`, atau `admin_profiles`).
- Jika terjadi kegagalan insert profil anak, server otomatis melakukan rollback penghapusan untuk mencegah akun zombie.

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Pengguna baru berhasil dibuat",
  "data": {
    "id": "uuid-pengguna-baru",
    "email": "dr.maya@temanbicara.id",
    "role": "psikolog",
    "status": "active",
    "fullName": "Dr. Maya Indah, M.Psi., Psikolog",
    "no_wa": "081299887766"
  }
}
```

---

### C. `GET /api/users/[id]` (Detail 1 Pengguna)

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-pengguna",
      "email": "dr.maya@temanbicara.id",
      "no_wa": "081299887766",
      "role": "psikolog",
      "status": "active",
      "avatar_url": null,
      "is_email_verified": true,
      "created_at": "2026-10-10T12:00:00Z",
      "updated_at": "2026-10-10T12:00:00Z",
      "fullName": "Dr. Maya Indah, M.Psi., Psikolog"
    },
    "profile": {
      "user_id": "uuid-pengguna",
      "nama_lengkap_gelar": "Dr. Maya Indah, M.Psi., Psikolog",
      "nomor_sipp_str": "SIPP-2026-0912",
      "spesialisasi": ["Konseling Umum"],
      "tahun_pengalaman": 1,
      "tarif_sesi": 150000,
      "saldo": 0,
      "verified_at": "2026-10-10T12:00:00Z",
      "rejection_reason": null
    },
    "fullName": "Dr. Maya Indah, M.Psi., Psikolog"
  }
}
```

---

### D. `PATCH /api/users/[id]` & `/api/users/[id]/status` (Ubah Status & Data)

#### Request Body untuk Ubah Status:
```json
{
  "status": "suspended"
}
```

Atau penolakan mitra dengan alasan:
```json
{
  "status": "rejected",
  "rejection_reason": "Nomor STR tidak ditemukan di pangkalan data Kemenkes."
}
```

#### Request Body untuk Perubahan Data:
```json
{
  "fullName": "Nama Baru Pengguna",
  "no_wa": "081122334455",
  "status": "active"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Data pengguna dan status akun berhasil diperbarui",
  "data": {
    "id": "uuid-pengguna",
    "status": "suspended",
    "updated_fields": ["status", "updated_at"]
  }
}
```

---

### E. `DELETE /api/users/[id]` (Hapus Pengguna Permanen)

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Pengguna user@temanbicara.id berhasil dihapus permanen"
}
```

---

## 4. Format Error Response

```json
{
  "success": false,
  "error": "CANNOT_SUSPEND_SELF",
  "message": "Admin tidak dapat menonaktifkan akun sendiri"
}
```

| HTTP Status | Kode Error | Deskripsi |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Format body / parameter filter tidak sesuai |
| `400` | `INVALID_ID` | Format ID bukan UUID yang valid |
| `400` | `CANNOT_SUSPEND_SELF` | Admin mencoba men-suspend akunnya sendiri |
| `400` | `CANNOT_DELETE_SELF` | Admin mencoba menghapus akunnya sendiri |
| `401` | `UNAUTHENTICATED` | Token sesi tidak ditemukan atau kedaluwarsa |
| `403` | `FORBIDDEN` | Pengguna bukan admin aktif |
| `404` | `NOT_FOUND` | Pengguna target tidak ditemukan |
| `409` | `EMAIL_EXISTS` | Email sudah digunakan oleh pengguna lain |
| `500` | `INTERNAL_ERROR` | Kesalahan internal server / basis data |

---

## 5. TypeScript Interfaces Siap Pakai

```typescript
export type ApiRole = "pasien" | "relawan" | "psikolog" | "admin";

export type ApiAccountStatus =
  | "active"
  | "unverified_email"
  | "incomplete_profile"
  | "pending_approval"
  | "pending_verification"
  | "rejected"
  | "suspended";

export interface AdminCreateUserPayload {
  email: string;
  password: string;
  role: ApiRole;
  fullName: string;
  no_wa?: string | null;
  status?: ApiAccountStatus;
  level?: string;
  nomor_sipp_str?: string;
  spesialisasi?: string[];
  tarif_sesi?: number;
}

export interface AdminUpdateUserPayload {
  status?: ApiAccountStatus;
  no_wa?: string | null;
  fullName?: string;
  role?: ApiRole;
  rejection_reason?: string;
}

export interface AdminUpdateStatusPayload {
  status: ApiAccountStatus;
  rejection_reason?: string;
}
```
