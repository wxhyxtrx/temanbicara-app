# Master Dokumentasi API Backend: TemanBicara

Dokumen ini merupakan referensi komprehensif seluruh endpoint REST API TemanBicara yang mencakup modul **Autentikasi**, **Manajemen Pengguna & Profil**, **Direktori Psikolog**, **Direktori Relawan**, dan **Penyimpanan Berkas (Upload)**.

---

## Informasi Lingkungan & Standar Global

- **Base URL Lokal:** `http://localhost:3000`
- **Format Pertukaran Data:** `application/json`
- **Mekanisme Autentikasi:**
  - Cookie HTTP (otomatis via browser): `tb_access_token`
  - Header HTTP: `Authorization: Bearer <supabase_access_token>`
- **Format Respon Standar:**
  - Sukses: `{ "success": true, "message": "...", "data": ... }`
  - Gagal: `{ "success": false, "error": "KODE_ERROR", "message": "Penjelasan error" }`

---

# DAFTAR ISI MODUL API

1. [Modul Autentikasi (`/api/auth`)](#1-modul-autentikasi-apiauth)
   - [1.1 POST /api/auth/register/pasien](#11-post-apiauthregisterpasien)
   - [1.2 POST /api/auth/register/relawan](#12-post-apiauthregisterrelawan)
   - [1.3 POST /api/auth/register/psikolog](#13-post-apiauthregisterpsikolog)
   - [1.4 POST /api/auth/login](#14-post-apiauthlogin)
   - [1.5 POST /api/auth/logout](#15-post-apiauthlogout)
   - [1.6 GET /api/auth/oauth/google/callback](#16-get-apiauthoauthgooglecallback)
   - [1.7 GET /api/auth/me](#17-get-apiauthme)
2. [Modul Manajemen Pengguna & Profil (`/api/users`)](#2-modul-manajemen-pengguna--profil-apiusers)
   - [2.1 GET /api/users/me](#21-get-apiusersme)
   - [2.2 GET /api/users](#22-get-apiusers)
   - [2.3 POST /api/users](#23-post-apiusers)
   - [2.4 GET /api/users/[id]](#24-get-apiusersid)
   - [2.5 PATCH /api/users/[id]](#25-patch-apiusersid)
   - [2.6 PATCH /api/users/[id]/status](#26-patch-apiusersidstatus)
   - [2.7 DELETE /api/users/[id]](#27-delete-apiusersid)
3. [Modul Katalog Psikolog Klinis (`/api/psychologists`)](#3-modul-katalog-psikolog-klinis-apipsychologists)
   - [3.1 GET /api/psychologists](#31-get-apipsychologists)
   - [3.2 GET /api/psychologists/[id]](#32-get-apipsychologistsid)
4. [Modul Direktori Relawan Sebaya (`/api/volunteers`)](#4-modul-direktori-relawan-sebaya-apivolunteers)
   - [3.1 GET /api/volunteers](#41-get-apivolunteers)
   - [3.2 GET /api/volunteers/[id]](#42-get-apivolunteersid)
5. [Modul Berkas & Unggahan (`/api/upload`)](#5-modul-berkas--unggahan-apiupload)
   - [5.1 POST /api/upload/presigned-url](#51-post-apiuploadpresigned-url)

---

# 1. Modul Autentikasi (`/api/auth`)

### 1.1 `POST /api/auth/register/pasien`
- **Ditujukan Ke:** Publik (Calon Pasien baru).
- **Fungsi & Tujuan:** Pendaftaran mandiri akun pasien umum. Akun langsung aktif (`status: active`) sehingga pasien bisa langsung masuk ke sistem.
- **Header:** `Content-Type: application/json`
- **Request Body (Payload):**
  ```json
  {
    "nama_lengkap": "Wahyu Tricahyo",
    "email": "wahyu@temanbicara.id",
    "no_wa": "081234567890",
    "password": "Password123!",
    "password_confirmation": "Password123!"
  }
  ```
- **Contoh Response Sukses (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Registrasi pasien berhasil. Silakan login.",
    "data": {
      "user_id": "a5e8f412-28cb-4e9b-a012-78d1f2b84910",
      "email": "wahyu@temanbicara.id",
      "role": "pasien",
      "status": "active",
      "redirect_to": "/patient/beranda"
    }
  }
  ```
- **Contoh Response Error (HTTP 409 Conflict):**
  ```json
  {
    "error": "EMAIL_ALREADY_EXISTS",
    "message": "Email sudah terdaftar. Silakan gunakan email lain atau login."
  }
  ```

---

### 1.2 `POST /api/auth/register/relawan`
- **Ditujukan Ke:** Publik (Calon Relawan Pendengar / Peer Listener).
- **Fungsi & Tujuan:** Mengajukan registrasi relawan pendengar curhat. Akun dibuat dengan status `pending_approval` dan memerlukan persetujuan admin sebelum dapat melayani antrean curhat.
- **Header:** `Content-Type: application/json`
- **Request Body (Payload):**
  ```json
  {
    "nama_lengkap": "Dewi Lestari, S.Psi",
    "email": "dewi@temanbicara.id",
    "no_wa": "081299887711",
    "password": "Password123!",
    "password_confirmation": "Password123!",
    "latar_belakang": "Sarjana Psikologi - Peminatan Klinis",
    "dokumen_cv_url": "dewi_temanbicara_id/cv-1728731920.pdf",
    "alasan_bergabung": "Ingin membantu menyediakan ruang dengar aman bagi generasi muda."
  }
  ```
- **Contoh Response Sukses (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Registrasi relawan berhasil diajukan. Menunggu verifikasi admin.",
    "data": {
      "user_id": "c1f7b822-1209-411a-bf41-89e4c192084b",
      "email": "dewi@temanbicara.id",
      "role": "relawan",
      "status": "pending_approval",
      "redirect_to": "/register/listener"
    }
  }
  ```

---

### 1.3 `POST /api/auth/register/psikolog`
- **Ditujukan Ke:** Publik (Tenaga Profesional Psikolog Klinis).
- **Fungsi & Tujuan:** Pendaftaran tenaga psikolog profesional. Memerlukan nomor Surat Izin Praktik Psikologi (SIPP/STR) dan berkas bukti lisensi resmi. Akun berstatus `pending_verification`.
- **Header:** `Content-Type: application/json`
- **Request Body (Payload):**
  ```json
  {
    "nama_lengkap_gelar": "Dr. Sarah Alatas, M.Psi., Psikolog",
    "email": "sarah@temanbicara.id",
    "no_wa": "081122334455",
    "password": "Password123!",
    "password_confirmation": "Password123!",
    "nomor_sipp_str": "SIPP-202104-1082-01",
    "dokumen_sipp_str_url": "sarah_temanbicara_id/sipp_str-1728731920.pdf",
    "spesialisasi": ["Kecemasan Dewasa", "Depresi Klinis", "Trauma Recovery"],
    "tahun_pengalaman": 7,
    "tarif_sesi": 150000
  }
  ```
- **Contoh Response Sukses (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Registrasi tenaga psikolog berhasil diajukan. Menunggu verifikasi dokumen oleh admin.",
    "data": {
      "user_id": "b3e9a112-30cb-46da-b789-99f2b1c84120",
      "email": "sarah@temanbicara.id",
      "role": "psikolog",
      "status": "pending_verification",
      "redirect_to": "/register/counselor"
    }
  }
  ```

---

### 1.4 `POST /api/auth/login`
- **Ditujukan Ke:** Semua Pengguna Terdaftar (Pasien, Relawan, Psikolog, Admin).
- **Fungsi & Tujuan:** Pintu masuk tunggal autentikasi. Memvalidasi email & password, menerbitkan JWT, menyetel HTTP-only cookies, dan menentukan rute tujuan berdasarkan matriks role dan status.
- **Header:** `Content-Type: application/json`
- **Request Body (Payload):**
  ```json
  {
    "email": "admin@temanbicara.id",
    "password": "AdminTemanBicara2026!",
    "remember_me": true
  }
  ```
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Login berhasil",
    "data": {
      "user": {
        "id": "e9b2190c-4fa2-44df-b59a-18f192b84a11",
        "email": "admin@temanbicara.id",
        "role": "admin",
        "status": "active",
        "avatar_url": null
      },
      "session": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh_token": "8g71h289hg...",
        "expires_at": 1728745520
      },
      "redirect_to": "/admin/beranda"
    }
  }
  ```
- **Cookies yang Disetel:**
  - `tb_access_token`: `<JWT Token>`
  - `tb_user_role`: `admin` | `pasien` | `psikolog` | `relawan`
  - `tb_user_status`: `active` | `pending_approval` | `pending_verification` | `suspended`

---

### 1.5 `POST /api/auth/logout`
- **Ditujukan Ke:** Pengguna yang sedang login.
- **Fungsi & Tujuan:** Menghapus seluruh session cookie di browser secara permanen.
- **Header:** Tidak membutuhkan body.
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Logout berhasil"
  }
  ```

---

### 1.6 `GET /api/auth/oauth/google/callback`
- **Ditujukan Ke:** Browser client (Redirect dari penyedia Google OAuth).
- **Fungsi & Tujuan:** Menangani penukaran authorization code PKCE menjadi sesi Supabase, auto-registrasi pasien baru, dan integrasi multi-role.
- **Query Params:**
  - `code`: Authorization code dari Google
  - `intent_role` (opsional): `'psikolog'` atau `'relawan'` (jika mendaftar mitra)
- **Contoh Respon:** HTTP 307/302 Redirect ke halaman dashboard atau step upload profil.

---

### 1.7 `GET /api/auth/me`
*(Merupakan alias identik dari `GET /api/users/me`)*
- **Ditujukan Ke:** Pengguna yang sedang login.
- **Fungsi & Tujuan:** Mengambil sesi pengguna aktif dan menggabungkan data profil spesifik peran. Digunakan oleh Zustand `syncSession` di frontend.
- **Spesifikasi Lengkap:** Lihat bagian [2.1 GET /api/users/me](#21-get-apiusersme).

---

# 2. Modul Manajemen Pengguna & Profil (`/api/users`)

### 2.1 `GET /api/users/me`
- **Ditujukan Ke:** Pengguna yang sedang login (Semua Role).
- **Fungsi & Tujuan:** Session hydration. Memberikan profil lengkap akun pemilik sesi untuk ditampilkan di navbar, header, dan halaman pengaturan profil.
- **Otorisasi:** Wajib Login (Cookie `tb_access_token` atau Header `Bearer`).
- **Contoh Response Sukses (HTTP 200 OK - Role Psikolog):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "b3e9a112-30cb-46da-b789-99f2b1c84120",
        "email": "sarah@temanbicara.id",
        "no_wa": "081122334455",
        "role": "psikolog",
        "status": "active",
        "avatar_url": null,
        "is_email_verified": true,
        "created_at": "2026-10-10T12:00:00Z",
        "updated_at": "2026-10-10T12:00:00Z",
        "fullName": "Dr. Sarah Alatas, M.Psi., Psikolog"
      },
      "profile": {
        "user_id": "b3e9a112-30cb-46da-b789-99f2b1c84120",
        "nama_lengkap_gelar": "Dr. Sarah Alatas, M.Psi., Psikolog",
        "nomor_sipp_str": "SIPP-202104-1082-01",
        "dokumen_sipp_str_url": "sarah/str.pdf",
        "spesialisasi": ["Kecemasan Dewasa"],
        "tahun_pengalaman": 7,
        "tarif_sesi": 150000,
        "saldo": 450000,
        "verified_at": "2026-10-11T10:00:00Z"
      },
      "fullName": "Dr. Sarah Alatas, M.Psi., Psikolog"
    }
  }
  ```

---

### 2.2 `GET /api/users`
- **Ditujukan Ke:** Khusus Role `admin` dengan status `active`.
- **Fungsi & Tujuan:** Menampilkan tabel direktori seluruh pengguna platform di portal backoffice dengan dukungan multi-filter dan pagination.
- **Query Params:**
  - `role` (opsional): `pasien` | `psikolog` | `relawan` | `admin`
  - `status` (opsional): `active` | `suspended` | `pending_approval` | `pending_verification` | `rejected` | `unverified_email` | `incomplete_profile`
  - `search` (opsional): Pencarian nama lengkap, email, atau nomor WhatsApp
  - `page` (opsional, default: `1`): Nomor halaman
  - `limit` (opsional, default: `20`): Jumlah baris per halaman
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "a5e8f412-28cb-4e9b-a012-78d1f2b84910",
        "email": "wahyu@temanbicara.id",
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
      "total": 45,
      "totalPages": 3
    }
  }
  ```
- **Contoh Response Error (HTTP 403 Forbidden):**
  ```json
  {
    "success": false,
    "error": "FORBIDDEN",
    "message": "Hanya admin yang dapat mengakses data ini"
  }
  ```

---

### 2.3 `POST /api/users`
- **Ditujukan Ke:** Khusus Role `admin` dengan status `active`.
- **Fungsi & Tujuan:** Pembuatan pengguna baru secara manual dari portal admin (misal: mendaftarkan operator baru atau onboarding manual psikolog).
- **Request Body (Payload):**
  ```json
  {
    "email": "dr.maya@temanbicara.id",
    "password": "Password123!",
    "role": "psikolog",
    "fullName": "Dr. Maya Indah, M.Psi",
    "no_wa": "081299887766",
    "status": "active",
    "nomor_sipp_str": "SIPP-2026-0912",
    "tarif_sesi": 150000
  }
  ```
- **Contoh Response Sukses (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Pengguna baru berhasil dibuat",
    "data": {
      "id": "d4e1289c-5120-410a-b109-1982a1b91823",
      "email": "dr.maya@temanbicara.id",
      "role": "psikolog",
      "status": "active",
      "fullName": "Dr. Maya Indah, M.Psi",
      "no_wa": "081299887766"
    }
  }
  ```

---

### 2.4 `GET /api/users/[id]`
- **Ditujukan Ke:** Khusus Role `admin` dengan status `active`.
- **Fungsi & Tujuan:** Mengambil detail lengkap 1 pengguna beserta data profil anak untuk modal inspeksi detail.
- **Path Params:** `[id]` (UUID user)
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "c1f7b822-1209-411a-bf41-89e4c192084b",
        "email": "dewi@temanbicara.id",
        "no_wa": "081299887711",
        "role": "relawan",
        "status": "pending_approval",
        "avatar_url": null,
        "is_email_verified": true,
        "created_at": "2026-10-11T09:00:00Z",
        "fullName": "Dewi Lestari, S.Psi"
      },
      "profile": {
        "user_id": "c1f7b822-1209-411a-bf41-89e4c192084b",
        "nama_lengkap": "Dewi Lestari, S.Psi",
        "latar_belakang": "Sarjana Psikologi",
        "dokumen_cv_url": "dewi/cv.pdf",
        "alasan_bergabung": "Membantu sesama",
        "total_sesi": 0
      },
      "fullName": "Dewi Lestari, S.Psi"
    }
  }
  ```

---

### 2.5 `PATCH /api/users/[id]` & 2.6 `PATCH /api/users/[id]/status`
- **Ditujukan Ke:** Khusus Role `admin` dengan status `active`.
- **Fungsi & Tujuan:** Memperbarui data pengguna atau mengubah status kepatuhan akun (menangguhkan pelanggar etika atau verifikasi persetujuan mitra).
- **Proteksi Khusus:** Admin tidak dapat men-suspend atau mendemosi perannya sendiri.
- **Path Params:** `[id]` (UUID user)
- **Request Body (Ubah Status Saja):**
  ```json
  {
    "status": "suspended"
  }
  ```
- **Request Body (Penolakan Mitra dengan Alasan):**
  ```json
  {
    "status": "rejected",
    "rejection_reason": "Nomor SIPP tidak terdaftar di direktori HIMPSI aktif."
  }
  ```
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Data pengguna dan status akun berhasil diperbarui",
    "data": {
      "id": "c1f7b822-1209-411a-bf41-89e4c192084b",
      "status": "rejected",
      "updated_fields": ["status", "updated_at"]
    }
  }
  ```

---

### 2.7 `DELETE /api/users/[id]`
- **Ditujukan Ke:** Khusus Role `admin` dengan status `active`.
- **Fungsi & Tujuan:** Menghapus akun pengguna secara permanen dari basis data dan Supabase Auth.
- **Proteksi Khusus:** Admin tidak dapat menghapus akunnya sendiri.
- **Path Params:** `[id]` (UUID user)
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengguna user@temanbicara.id berhasil dihapus permanen"
  }
  ```

---

# 3. Modul Katalog Psikolog Klinis (`/api/psychologists`)

### 3.1 `GET /api/psychologists`
- **Ditujukan Ke:** Publik & Pasien.
- **Fungsi & Tujuan:** Menampilkan daftar katalog psikolog terverifikasi (`status: active`) di beranda pasien untuk pemesanan jadwal sesi konsultasi.
- **Data Masking (Privasi):** Saldo honorarium, dokumen STR internal, email, dan nomor WhatsApp pribadi diblokir dari respons.
- **Query Params:**
  - `page` (opsional, default: `1`)
  - `limit` (opsional, default: `12`)
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "b3e9a112-30cb-46da-b789-99f2b1c84120",
        "nama_lengkap_gelar": "Dr. Sarah Alatas, M.Psi., Psikolog",
        "spesialisasi": ["Kecemasan Dewasa", "Depresi Klinis"],
        "tahun_pengalaman": 7,
        "tarif_sesi": 150000,
        "avatar_url": "https://.../avatar.jpg"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 12,
      "total": 8
    }
  }
  ```

---

### 3.2 `GET /api/psychologists/[id]`
- **Ditujukan Ke:** Publik & Pasien.
- **Fungsi & Tujuan:** Mengambil profil detail 1 orang psikolog saat pasien mengklik kartu psikolog untuk melihat riwayat dan memilih jadwal.
- **Path Params:** `[id]` (UUID psikolog)
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "b3e9a112-30cb-46da-b789-99f2b1c84120",
      "nama_lengkap_gelar": "Dr. Sarah Alatas, M.Psi., Psikolog",
      "spesialisasi": ["Kecemasan Dewasa", "Depresi Klinis"],
      "tahun_pengalaman": 7,
      "tarif_sesi": 150000,
      "avatar_url": "https://.../avatar.jpg"
    }
  }
  ```

---

# 4. Modul Direktori Relawan Sebaya (`/api/volunteers`)

### 4.1 `GET /api/volunteers`
- **Ditujukan Ke:** Publik & Pasien.
- **Fungsi & Tujuan:** Menampilkan daftar relawan pendengar curhat yang aktif (`status: active`) di beranda pasien untuk antrean *peer support*.
- **Two-Way Privacy Masking:** Nama asli, nomor WA, email, dan CV diblokir total. Hanya menampilkan `alias_name`, `avatar_url`, `topik_keahlian`, `total_sesi`, `rating_rata_rata`, dan `is_available`.
- **Query Params:** `page`, `limit`
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "c1f7b822-1209-411a-bf41-89e4c192084b",
        "alias_name": "Teman Dewi",
        "avatar_url": null,
        "topik_keahlian": ["Stres Kuliah", "Quarter Life Crisis"],
        "total_sesi": 48,
        "rating_rata_rata": 4.9,
        "is_available": true
      }
    ],
    "meta": {
      "page": 1,
      "limit": 12,
      "total": 14
    }
  }
  ```

---

### 4.2 `GET /api/volunteers/[id]`
- **Ditujukan Ke:** Publik & Pasien.
- **Fungsi & Tujuan:** Menampilkan detail 1 relawan pendengar sebelum pasien memulai ruang curhat sebaya.
- **Path Params:** `[id]` (UUID relawan)
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "c1f7b822-1209-411a-bf41-89e4c192084b",
      "alias_name": "Teman Dewi",
      "avatar_url": null,
      "topik_keahlian": ["Stres Kuliah", "Quarter Life Crisis"],
      "total_sesi": 48,
      "rating_rata_rata": 4.9,
      "is_available": true
    }
  }
  ```

---

# 5. Modul Berkas & Unggahan (`/api/upload`)

### 5.1 `POST /api/upload/presigned-url`
- **Ditujukan Ke:** Calon Mitra & Pengguna Terautentikasi (Relawan, Psikolog, Pasien).
- **Fungsi & Tujuan:** Menerbitkan URL bertanda tangan (*Signed Upload URL*) berdurasi 120 detik untuk mengunggah dokumen sensitif langsung ke private bucket Supabase Storage (`dokumen-mitra`), mencegah beban bandwidth dan limit 4.5MB serverless Vercel.
- **Header:** `Content-Type: application/json`
- **Request Body (Payload):**
  ```json
  {
    "file_name": "surat_izin_praktik.pdf",
    "file_type": "application/pdf",
    "document_type": "sipp_str",
    "user_email_or_temp_id": "sarah@temanbicara.id"
  }
  ```
  *Keterangan Tipe yang Didukung:*
  - `file_type`: `'application/pdf'` | `'image/jpeg'` | `'image/png'`
  - `document_type`: `'cv'` | `'sipp_str'`
- **Contoh Response Sukses (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "upload_url": "https://mcciuvlqvvvptgmelexi.supabase.co/storage/v1/object/upload/sign/dokumen-mitra/sarah_temanbicara_id/sipp_str-1728741029.pdf?token=...",
      "token": "eyJhbGciOi...",
      "file_path": "sarah_temanbicara_id/sipp_str-1728741029.pdf",
      "bucket": "dokumen-mitra"
    }
  }
  ```
- **Cara Penggunaan di Klien:**
  Frontend melakukan HTTP `PUT` biner file langsung ke URL `upload_url`, lalu menyimpan string `file_path` ke form registrasi atau profil.

---

## Ringkasan Matriks Hak Akses

| Endpoint | Publik | Pasien | Psikolog | Relawan | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /api/auth/register/*` | ✅ | - | - | - | - |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/logout` | - | ✅ | ✅ | ✅ | ✅ |
| `GET /api/users/me` (`/api/auth/me`) | - | ✅ | ✅ | ✅ | ✅ |
| `GET /api/psychologists` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/volunteers` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/upload/presigned-url` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/users` (List) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `POST /api/users` (Create) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `GET /api/users/[id]` (Detail) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/users/[id]` (Update) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `DELETE /api/users/[id]` (Delete) | ❌ | ❌ | ❌ | ❌ | ✅ |
