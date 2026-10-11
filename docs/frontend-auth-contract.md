# Dokumentasi Kontrak Integrasi Frontend (Auth & Onboarding Teman Bicara)

## Base URL
`http://localhost:3000` (Development)

---

## 1. Request Signed Upload URL (Sebelum Submit Berkas)
Digunakan oleh Calon Relawan (Upload CV) dan Calon Psikolog (Upload SIPP/STR).

- **Endpoint:** `POST /api/upload/presigned-url`
- **Request Body:**
```json
{
  "file_name": "surat-izin-praktik.pdf",
  "file_type": "application/pdf",
  "document_type": "sipp_str",
  "user_email_or_temp_id": "budi.santoso@gmail.com"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://mcciuvlqvvvptgmelexi.supabase.co/storage/v1/object/upload/sign/dokumen-mitra/budi_santoso_gmail_com/sipp_str-1728641234.pdf?token=...",
    "token": "...",
    "file_path": "budi_santoso_gmail_com/sipp_str-1728641234.pdf",
    "bucket": "dokumen-mitra"
  }
}
```
*Catatan FE:* Lakukan `PUT` file binary ke `upload_url`, lalu kirim `file_path` ke form registrasi sebagai `dokumen_sipp_str_url` atau `dokumen_cv_url`.

---

## 2. Register Pasien
- **Endpoint:** `POST /api/auth/register/pasien`
- **Request Body:**
```json
{
  "nama_lengkap": "Ahmad Fauzi",
  "email": "ahmad.fauzi@example.com",
  "no_wa": "081234567890",
  "password": "Password123!",
  "password_confirmation": "Password123!"
}
```
- **Response Success (201 Created):**
```json
{
  "success": true,
  "message": "Registrasi pasien berhasil. Silakan login.",
  "data": {
    "user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "email": "ahmad.fauzi@example.com",
    "role": "pasien",
    "status": "active"
  }
}
```

---

## 3. Register Relawan (Peer Counselor)
- **Endpoint:** `POST /api/auth/register/relawan`
- **Request Body:**
```json
{
  "nama_lengkap": "Siti Nurhaliza",
  "email": "siti.relawan@example.com",
  "no_wa": "081987654321",
  "password": "Password123!",
  "password_confirmation": "Password123!",
  "latar_belakang": "Mahasiswa S1 Psikologi Semester 7",
  "dokumen_cv_url": "siti_relawan_example_com/cv-1728641234.pdf",
  "alasan_bergabung": "Ingin menjadi pendengar suportif bagi mereka yang membutuhkan ruang aman."
}
```
- **Response Success (201 Created):**
```json
{
  "success": true,
  "message": "Registrasi relawan berhasil diajukan. Menunggu verifikasi admin.",
  "data": {
    "user_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "email": "siti.relawan@example.com",
    "role": "relawan",
    "status": "pending_approval",
    "redirect_to": "/register/listener"
  }
}
```

---

## 4. Register Psikolog
- **Endpoint:** `POST /api/auth/register/psikolog`
- **Request Body:**
```json
{
  "nama_lengkap_gelar": "Dr. Nadia Wijaya, M.Psi., Psikolog",
  "email": "nadia.psikolog@example.com",
  "no_wa": "081345678901",
  "password": "Password123!",
  "password_confirmation": "Password123!",
  "nomor_sipp_str": "19876543-2023-STR",
  "dokumen_sipp_str_url": "nadia_psikolog_example_com/sipp_str-1728641234.pdf",
  "spesialisasi": ["Trauma", "Anxiety & Depresi", "Relationship"],
  "tahun_pengalaman": 6,
  "tarif_sesi": 150000
}
```
- **Response Success (201 Created):**
```json
{
  "success": true,
  "message": "Registrasi tenaga psikolog berhasil diajukan. Menunggu verifikasi dokumen oleh admin.",
  "data": {
    "user_id": "f5e4d3c2-b1a0-4987-9876-123456abcdef",
    "email": "nadia.psikolog@example.com",
    "role": "psikolog",
    "status": "pending_verification",
    "redirect_to": "/register/counselor"
  }
}
```

---

## 5. Login Seragam (Semua Role)
- **Endpoint:** `POST /api/auth/login`
- **Request Body:**
```json
{
  "email": "ahmad.fauzi@example.com",
  "password": "Password123!",
  "remember_me": true
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "user": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "email": "ahmad.fauzi@example.com",
      "role": "pasien",
      "status": "active",
      "avatar_url": null
    },
    "session": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "...",
      "expires_at": 1728645000
    },
    "redirect_to": "/patient/beranda"
  }
}
```
*Catatan Mapping Redirect Sukses:*
- Pasien: `/patient/beranda`
- Psikolog: `/counselor/beranda`
- Relawan: `/listener/beranda`
- Admin: `/admin/beranda`
```
- **Response Error (403 Forbidden - Khusus Akun Belum Lolos Verifikasi):**
```json
{
  "error": "ACCOUNT_SUSPENDED",
  "message": "Akun Anda telah dinonaktifkan oleh administrator. Hubungi bantuan."
}
```

---

## 6. TypeScript Interface Siap Salin (Untuk FE / Rimuru)

```typescript
export type UserRole = 'pasien' | 'relawan' | 'psikolog' | 'admin';
export type AccountStatus =
  | 'active'
  | 'unverified_email'
  | 'incomplete_profile'
  | 'pending_approval'
  | 'pending_verification'
  | 'rejected'
  | 'suspended';

export interface UserAuthSession {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  avatar_url: string | null;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: UserAuthSession;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
    redirect_to: string;
  };
}
```
