# Fase 3 Booking & Sesi Psikolog — Implementation Plan

> **For agentic workers:** Dikerjakan oleh agen Bang Wahyu: **Paul (BE)** di worktree `temanbicara-be`, **Rimuru (FE)** di `temanbicara`. Satu task = satu "New task" (<100 langkah). Konsultan (Claude) mereview setiap task sebelum merge. Steps pakai checkbox (`- [ ]`).

**Goal:** Pasien bisa booking slot psikolog dengan koin, menjalani sesi chat 45 menit, lalu memberi rating/ulasan/tip; psikolog mengatur jadwal, menjalankan sesi, dan menulis catatan klien.

**Architecture:** Semua aturan uang & status ada di Postgres sebagai RPC `SECURITY DEFINER SET search_path=''` yang atomik & idempoten; API Next.js hanya cek sesi/role lalu memanggil RPC lewat `supabaseAdmin`. Timer (telat, no-show, hard cap, batas pilihan) dijalankan `session_tick()` via pg_cron tiap menit. Chat realtime via Supabase Realtime (`postgres_changes` di `session_messages`, dibatasi RLS peserta).

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres, RLS, pg_cron, Realtime, Storage), Zod v4, zustand.

**Spec:** `docs/specs/2026-10-17-fase3-booking-sesi-design.md`

## Global Constraints

- 1 koin = Rp 10.000; dompet pasien = koin, saldo mitra = rupiah.
- Semua waktu disimpan `timestamptz`; logika hari/jam memakai `AT TIME ZONE 'Asia/Jakarta'` (WIB).
- Slot = 60 menit, mulai di jam bulat WIB. Sesi 45 menit dari `start_at`; ekstensi 10 menit (maks 1); hard cap `start_at + 58 menit`.
- Snapshot ke booking saat dibuat: `price_coins = tarif_sesi/10000`, `mitra_share_bps`, `extension_price_coins`, `refund_policy`, identitas tampilan pasien.
- Bagi hasil = `floor(coins × 10000 × mitra_share_bps / 10000)` rupiah ke `mitra_earnings` (holding `holding.hours`), sisa ke platform_revenue.
- Ledger append-only; setiap peristiwa uang memakai `ref_type='booking'` + `ref_id=booking_id` dan constraint unik yang ada → idempoten.
- Setiap migrasi: file `supabase/migrations/2026101700000N_*.sql` + dry-run `supabase/tests/*_dryrun.sql` (BEGIN…ROLLBACK, DDL salinan persis, setup `auth.users` → `public.users` seperti `admin_stats_dryrun.sql`). Agen **tidak menjalankan** migrasi; Bang Wahyu menjalankan setelah review.
- RPC baru: `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role`.
- API: `getSessionUser()` + cek role + `status='active'`; error 401/403/404/409/422 dengan `{ success:false, error, message }`.
- Psikolog **tidak pernah** menerima `nama_lengkap`, email, `no_wa`, atau kontak darurat pasien; hanya `patient_display_name` snapshot.
- Catatan klien: hanya psikolog penulis (RLS + API); admin pun tidak.
- Setiap task: `npx tsc --noEmit` + `npm run build` lulus; 1 commit per poin; tidak push/merge; selesai tetap di branch kerja.
- BE hanya ubah `src/app/api`, `src/lib`, `src/services`, `src/types`, `supabase/`. FE tidak mengubah `src/app/api` & `src/lib/validations`.
- docs/ tidak pernah masuk git (jangan `git add -f`).

## Review Focus

1. **Booking bersamaan di slot yang sama** → hanya satu sukses; yang lain `SLOT_UNAVAILABLE` dan saldo koinnya tidak berubah. (Task B4)
2. **Batas hari WIB** → pola "Minggu 23.00–24.00" menghasilkan slot Minggu 23.00 WIB, bukan Senin/Sabtu (bug UTC). (Task B3)
3. **`session_tick()` jalan dua kali / bertumpuk** → tidak ada refund atau earning ganda. (Task B6b)
4. **Saldo pas-pasan** → booking/ekstensi dengan saldo kurang gagal utuh tanpa debit parsial. (Task B4, B6b)
5. **Kebocoran identitas pasien** → response API psikolog untuk booking/sesi/catatan tidak memuat `nama_lengkap`, `email`, `no_wa`, `kontak_darurat_*`. (Task B7)

---

## Bagian BE (Paul)

### Task B1: Pengaturan admin baru (booking, strike, rating)

**Files:**
- Create: `supabase/migrations/20261017000009_booking_settings.sql`, `supabase/tests/booking_settings_dryrun.sql`
- Modify: `src/lib/validations/system-settings.ts`, `src/types/system-settings.ts`, `src/constant/system-settings.ts` (DEFAULT_*), `src/services/system-settings.service.ts` (public settings ikut `booking`, `rating`; `strike` admin-only), `src/components/views/admin/settings/settings-form-parts.tsx` (FLAT_GROUPS)

**Interfaces — Produces:**
- `booking: { min_hours_before:2, max_days_ahead:14, max_active_per_patient:3, max_per_psikolog_per_day:1, reschedule_min_hours:24, psikolog_cancel_free_hours:24, choice_deadline_hours:48 }`
- `strike: { per_late_cancel:1, per_noshow:2, threshold:3, window_days:30, suspend_days:7 }`
- `rating: { window_days:7, min_count_to_show:3 }`

- [ ] **Step 1: Dry-run** — INSERT 3 key `ON CONFLICT DO NOTHING`; assert `SELECT value->>'max_active_per_patient' = '3'`, `strike.threshold = 3`, `rating.min_count_to_show = 3`; ROLLBACK.
- [ ] **Step 2: Zod** — semua int ≥ 1 kecuali `per_late_cancel`/`max_per_psikolog_per_day` ≥ 1, `psikolog_cancel_free_hours` ≥ 0; refine `max_days_ahead × 24 > min_hours_before`.
- [ ] **Step 3: UI admin** — kelompok "Booking" & "Strike & Rating" di tab **Sesi**.
- [ ] **Step 4:** tsc + build. Commit `feat(settings): add booking, strike, rating settings`.

### Task B2: Jadwal psikolog (pola mingguan, libur, jeda, harga ekstensi)

**Files:**
- Create: `supabase/migrations/20261017000010_psikolog_schedule.sql`, `supabase/tests/psikolog_schedule_dryrun.sql`, `src/app/api/counselor/schedule/route.ts`, `src/app/api/counselor/time-off/route.ts`, `src/app/api/counselor/time-off/[id]/route.ts`, `src/lib/validations/schedule.ts`, `src/services/schedule.client.ts`
- Modify: `src/lib/validations/user.ts` (psikolog: `booking_paused`, `extension_price_coins`), `src/types/user-profile.ts`

**Interfaces — Produces:**
- Tabel `psikolog_schedules(id uuid pk, psikolog_id uuid fk users, weekday smallint 0–6 (0=Minggu, WIB), start_hour smallint 0–23, end_hour smallint 1–24, CHECK end_hour > start_hour)`.
- Tabel `psikolog_time_off(id uuid pk, psikolog_id, start_at timestamptz, end_at timestamptz CHECK end_at > start_at, reason text null)`.
- `psikolog_profiles` + `booking_paused boolean NOT NULL DEFAULT false`, `extension_price_coins int NULL`, `suspended_until timestamptz NULL`.
- `GET /api/counselor/schedule` → `{ weekly: {weekday,start_hour,end_hour}[], time_off: {...}[], booking_paused, extension_price_coins }`
- `PUT /api/counselor/schedule` body `{ weekly: [...] }` → ganti semua baris pola milik psikolog (rentang di hari yang sama tidak boleh tumpang tindih → 422).
- `POST /api/counselor/time-off` `{ start_at, end_at, reason? }` → 201 + `conflicting_bookings: {id,start_at}[]` (booking aktif yang tertimpa, untuk peringatan UI); `DELETE /api/counselor/time-off/[id]`.
- `PATCH /api/users/me` psikolog menerima `booking_paused` (bool) dan `extension_price_coins` (int dalam `extension_price.min_coins..max_coins`, validasi di route dari settings).

- [ ] **Step 1: Dry-run** — buat psikolog test; insert pola valid; assert insert `start_hour=21,end_hour=19` gagal (CHECK); assert kolom profil baru ada dengan default.
- [ ] **Step 2:** RLS: enable di 2 tabel; tanpa policy untuk anon/authenticated (akses lewat API service role).
- [ ] **Step 3:** Route + Zod (`weekday` 0–6, jam int, maks 10 rentang/hari); hanya role psikolog aktif.
- [ ] **Step 4:** tsc + build. Commit.

### Task B3: Generator slot

**Files:**
- Create: `supabase/migrations/20261017000011_available_slots.sql`, `supabase/tests/available_slots_dryrun.sql`, `src/app/api/psychologists/[id]/slots/route.ts`

**Interfaces:**
- Consumes: B1 `booking.min_hours_before/max_days_ahead`, B2 tabel jadwal.
- Produces: `public.psikolog_available_slots(p_psikolog_id uuid, p_from timestamptz, p_to timestamptz) RETURNS SETOF timestamptz` (STABLE). Slot = tiap jam di pola mingguan (weekday/hour dihitung dalam WIB) − time_off yang beririsan − booking berstatus `booked`/`in_progress` − slot `< now()+min_hours_before` − slot `> now()+max_days_ahead`. Kosong jika `booking_paused`, `suspended_until > now()`, atau user tidak aktif.
- `GET /api/psychologists/[id]/slots?from=YYYY-MM-DD&days=7` (publik, days ≤ 14) → `{ slots: string[] /* ISO */ }`.

- [ ] **Step 1: Dry-run (tes)** — psikolog pola Senin 19–21 → assert tepat 2 slot Senin 19.00 & 20.00 WIB dalam minggu uji; tambah time_off Senin 19–20 → 1 slot; **Review Focus #2:** pola Minggu (weekday 0) 23–24 → slot jatuh Minggu 23.00 WIB (`to_char(slot AT TIME ZONE 'Asia/Jakarta','D HH24')='1 23'`); `booking_paused=true` → 0 slot. (Booking belum ada; filter booking diuji di B4.)
- [ ] **Step 2:** Implement fungsi (pakai `generate_series` per hari WIB).
- [ ] **Step 3:** Route publik memanggil RPC; tsc + build. Commit.

### Task B4: Tabel booking + booking_create + batal/pindah oleh pasien

**Files:**
- Create: `supabase/migrations/20261017000012_bookings.sql`, `supabase/tests/bookings_dryrun.sql`, `src/app/api/bookings/route.ts` (POST, GET), `src/app/api/bookings/[id]/route.ts` (GET), `src/app/api/bookings/[id]/cancel/route.ts`, `src/app/api/bookings/[id]/reschedule/route.ts`, `src/lib/validations/booking.ts`, `src/services/booking.client.ts`, `src/types/booking.ts`

**Interfaces — Produces:**
- Tabel `bookings`: `id uuid pk, patient_id, psikolog_id, start_at timestamptz, status text CHECK IN ('booked','in_progress','completed','cancelled_by_patient','cancelled_by_psikolog','awaiting_patient_choice','auto_cancelled_late','no_show'), keluhan text CHECK length 20–1000, price_coins int >0, mitra_share_bps int, extension_price_coins int null, refund_policy jsonb, patient_display_name text, reschedule_count smallint default 0, psikolog_first_msg_at, patient_first_msg_at, psikolog_late boolean default false, extension_status text null CHECK IN ('requested','approved','declined'), extension_coins int null, ended_at, cancelled_at, choice_deadline_at, refund_coins int default 0, created_at, updated_at`.
- Unique partial index `(psikolog_id, start_at) WHERE status IN ('booked','in_progress')`.
- `patient_display_name` = `'Pasien Anonim'` jika `is_anonim_default`, else `nama_panggilan`, else kata pertama `nama_lengkap`.
- `public.booking_create(p_booking_id uuid, p_patient_id uuid, p_psikolog_id uuid, p_start_at timestamptz, p_keluhan text) RETURNS public.bookings` — cek slot ada di `psikolog_available_slots`, batas `max_active_per_patient` & `max_per_psikolog_per_day` (hari WIB), debit `price_coins` (`apply_wallet_ledger_internal`, reason `'booking_payment'`), insert booking. Error codes (RAISE EXCEPTION teks): `SLOT_UNAVAILABLE`, `LIMIT_ACTIVE`, `LIMIT_DAILY`, `INSUFFICIENT_COINS`, `PSIKOLOG_UNAVAILABLE`. Unique violation → `SLOT_UNAVAILABLE`.
- `public.booking_cancel_by_patient(p_booking_id, p_patient_id) RETURNS public.bookings` — status harus `booked`; refund pct dari tier snapshot berdasar menit ke `start_at` (65% → `ceil`); kredit koin (reason `'booking_refund'`); sisa dibakar → `mitra_earnings` source `'refund_share'` + platform.
- `public.booking_reschedule(p_booking_id, p_patient_id, p_new_start_at) RETURNS public.bookings` — mode A (status `booked`): butuh `reschedule_count = 0` dan `start_at - now() > reschedule_min_hours`; mode B (status `awaiting_patient_choice`): tanpa batas 24 jam. Slot baru wajib tersedia, psikolog sama; `reschedule_count += 1` hanya mode A; status → `booked`.
- API: `POST /api/bookings {psikolog_id,start_at,keluhan}` → 201 booking; map error → 409 (`SLOT_UNAVAILABLE`,`LIMIT_*`), 402 (`INSUFFICIENT_COINS`), 422 (validasi). `GET /api/bookings?scope=upcoming|history` role-aware. Response untuk psikolog TIDAK berisi data pribadi pasien.

- [ ] **Step 1: Dry-run (tes)** — pasien saldo 30 koin, psikolog tarif Rp 150.000 (15 koin):
  - booking pertama sukses, saldo 15; **Review Focus #1:** booking kedua slot sama oleh pasien lain → exception `SLOT_UNAVAILABLE`, saldo pasien lain tetap;
  - **Review Focus #4:** pasien saldo 10 → `INSUFFICIENT_COINS`, saldo tetap 10, tidak ada booking;
  - 4 booking aktif → yang ke-4 `LIMIT_ACTIVE`; 2 booking ke psikolog sama di hari WIB sama → `LIMIT_DAILY`;
  - batal 90 menit sebelum → refund 15; batal 45 menit sebelum → refund `ceil(15×0.65)=10`, earning `floor(5×10000×bps/10000)`; batal 10 menit sebelum → refund 0;
  - reschedule 30 jam sebelum sukses (count=1); reschedule kedua → gagal; reschedule 20 jam sebelum → gagal.
  - (Waktu diuji dengan `start_at` relatif `now()`; slot memakai pola yang mencakup jam uji.)
- [ ] **Step 2:** Migrasi tabel + index + RLS (peserta boleh SELECT booking miliknya; tulis hanya via RPC) + 3 RPC.
- [ ] **Step 3:** Route + Zod + client service + types.
- [ ] **Step 4:** tsc + build. Commit per bagian (DB, API).

### Task B5: Pembatalan oleh psikolog, pilihan pasien, strike

**Files:**
- Create: `supabase/migrations/20261017000013_psikolog_cancel_strikes.sql`, `supabase/tests/psikolog_cancel_dryrun.sql`, `src/app/api/bookings/[id]/choose-refund/route.ts`
- Modify: `src/app/api/bookings/[id]/cancel/route.ts` (role psikolog), `src/app/api/users/[id]/route.ts` (admin: ringkasan strike)

**Interfaces — Produces:**
- Tabel `psikolog_strikes(id, psikolog_id, booking_id unique, points smallint, reason text CHECK IN ('late_cancel','noshow'), created_at)`.
- `public.booking_cancel_by_psikolog(p_booking_id, p_psikolog_id) RETURNS public.bookings` — status `booked` → `awaiting_patient_choice`, `choice_deadline_at = least(now()+choice_deadline_hours, start_at)`; strike `per_late_cancel` jika `start_at - now() < psikolog_cancel_free_hours`; lalu `apply_strike_suspension`.
- `public.booking_choose_refund(p_booking_id, p_patient_id)` — status `awaiting_patient_choice` → `cancelled_by_psikolog`, refund 100%.
- `public.apply_strike_suspension(p_psikolog_id)` (internal) — jika `sum(points)` dalam `window_days` ≥ `threshold` → `suspended_until = now() + suspend_days` (tidak memendekkan yang sudah ada).
- Pindah jadwal pilihan pasien memakai `booking_reschedule` mode B (B4).
- `attendance_pct` untuk profil publik = completed / (completed + cancelled_by_psikolog + auto_cancelled_late) × 100, null jika penyebut 0.

- [ ] **Step 1: Dry-run (tes)** — batal 48 jam sebelum → 0 strike, status `awaiting_patient_choice`; batal 5 jam sebelum → 1 strike; 3 poin dalam 30 hari → `suspended_until` ≈ now()+7 hari dan `psikolog_available_slots` kosong; `booking_choose_refund` → saldo pasien kembali penuh, status `cancelled_by_psikolog`; panggil `booking_choose_refund` dua kali → tidak ada refund ganda.
- [ ] **Step 2:** Implement + route. tsc + build. Commit.

### Task B6a: Pesan sesi + media + realtime

**Files:**
- Create: `supabase/migrations/20261017000014_session_messages.sql`, `supabase/tests/session_messages_dryrun.sql`, `src/app/api/bookings/[id]/messages/route.ts` (GET, POST), `src/app/api/bookings/[id]/media-url/route.ts`

**Interfaces — Produces:**
- Tabel `session_messages(id uuid pk, booking_id fk, sender_id, kind text CHECK IN ('text','image','voice'), body text null (≤4000), media_path text null, duration_seconds int null, created_at)`; tambahkan ke publication `supabase_realtime`.
- RLS SELECT: peserta booking (`auth.uid()` = patient_id atau psikolog_id). INSERT hanya via API (service role).
- Trigger `session_message_after_insert`: set `psikolog_first_msg_at`/`patient_first_msg_at` jika null; status `booked` → `in_progress` pada pesan pertama psikolog; jika `psikolog_first_msg_at > start_at` → `psikolog_late = true` (kehilangan hak ekstensi).
- POST hanya jika `now()` antara `start_at - 10 menit` dan batas akhir (`start_at + 45`, `+55` bila ekstensi approved, maks `+58`), status `booked`/`in_progress`. Pasien boleh menulis sebelum psikolog menyapa.
- Bucket private `session-media` (image ≤ `upload.chat_media_max_mb`, audio ≤ `voice_note_max_seconds`); `media-url` mengembalikan signed URL 600 detik untuk peserta.

- [ ] **Step 1: Dry-run (tes)** — insert pesan psikolog → status `in_progress`, `psikolog_first_msg_at` terisi; pesan kedua tidak mengubah timestamp; RLS: `SET LOCAL role authenticated` + `request.jwt.claims` sub = orang lain → 0 baris.
- [ ] **Step 2:** Implement + routes. tsc + build. Commit.

### Task B6b: Siklus sesi (ekstensi, akhiri, tick, uang)

**Files:**
- Create: `supabase/migrations/20261017000015_session_lifecycle.sql`, `supabase/tests/session_lifecycle_dryrun.sql`, `src/app/api/bookings/[id]/extension/route.ts` (POST request), `src/app/api/bookings/[id]/extension/respond/route.ts`, `src/app/api/bookings/[id]/end/route.ts`

**Interfaces — Produces:**
- `public.booking_settle_internal(p_booking_id, p_outcome text)` — `completed`/`no_show`: earnings `price_coins` (source `'session'`) + ekstensi bila approved (source `'extension'`, source_id = booking_id); `auto_cancelled_late`: refund 100% + strike `per_noshow`.
- `public.extension_request(p_booking_id, p_patient_id)` — hanya `in_progress`, `psikolog_late=false`, `extension_status IS NULL`, `extension_price_coins IS NOT NULL`, dan `now() < start_at + 45 menit`; status `requested`.
- `public.extension_respond(p_booking_id, p_psikolog_id, p_approve boolean) RETURNS text` — hasil `'approved'` (debit `extension_price_coins`, reason `'extension_payment'`), `'declined'`, atau `'insufficient_coins'` (tanpa debit, `extension_status='declined'`). Tidak RAISE untuk saldo kurang, agar status `declined` tersimpan.
- `public.session_end(p_booking_id, p_psikolog_id)` — `in_progress` → `completed`, `ended_at=now()`, settle.
- `public.session_tick() RETURNS int` (jumlah booking diproses), dijadwalkan `cron.schedule('session-tick','* * * * *', 'SELECT public.session_tick();')`:
  - `booked` & `psikolog_first_msg_at IS NULL` & `now() > start_at + psikolog_late` → `auto_cancelled_late` + settle.
  - `in_progress` & `patient_first_msg_at IS NULL` & `now() > psikolog_first_msg_at + patient_noshow` → `no_show` + settle.
  - `in_progress` & `now() >= start_at + 58 menit` → `completed` + settle.
  - `awaiting_patient_choice` & `now() > choice_deadline_at` → `cancelled_by_psikolog` + refund 100%.
  - Proses per baris dengan `FOR UPDATE SKIP LOCKED`.

- [ ] **Step 1: Dry-run (tes)** — sesi selesai → earning mitra `floor(price×10000×bps/10000)`, platform sisa; **Review Focus #3:** `session_tick()` dipanggil 2× berturut-turut → jumlah baris `mitra_earnings` & ledger untuk booking itu tetap sama; psikolog tidak menyapa (start_at diset 15 menit lalu) → `auto_cancelled_late`, refund penuh, strike 2; no-show pasien → `no_show`, refund 0, earning terbentuk; **Review Focus #4:** ekstensi approve dengan saldo kurang → hasil `'insufficient_coins'`, saldo tetap, `extension_status='declined'`; psikolog telat → `extension_request` ditolak.
- [ ] **Step 2:** Implement + cron + routes. tsc + build. Commit.

### Task B7: Catatan klien + penyaringan identitas

**Files:**
- Create: `supabase/migrations/20261017000016_client_notes.sql`, `supabase/tests/client_notes_dryrun.sql`, `src/app/api/bookings/[id]/note/route.ts` (GET, PUT), `src/app/api/counselor/patients/[patientId]/notes/route.ts` (GET)

**Interfaces — Produces:**
- Tabel `client_notes(booking_id pk fk, psikolog_id, patient_id, body text ≤ 5000, created_at, updated_at)`; RLS: SELECT/UPDATE hanya `auth.uid() = psikolog_id`; tanpa akses admin.
- PUT hanya psikolog booking tsb, status `in_progress`/`completed`.
- GET `/api/counselor/patients/[patientId]/notes` → catatan psikolog itu untuk pasien itu saja (urut terbaru) + `patient_display_name` terbaru.
- Helper `toPsikologBookingView(booking)` di `src/lib/booking/views.ts` — satu-satunya bentuk booking yang dikirim ke psikolog (hanya `id,start_at,status,keluhan,patient_display_name,price_coins,extension_*`).

- Kontak darurat untuk admin: `GET /api/admin/users/[id]/emergency-contact` (admin aktif saja) mengembalikan `kontak_darurat_nama/wa` dan menulis baris ke tabel baru `emergency_contact_access_log(id, admin_id, patient_id, created_at)` (tanpa akses baca selain admin).

- [ ] **Step 1: Dry-run (tes)** — RLS: psikolog B tidak bisa membaca catatan psikolog A (0 baris); tabel log akses ada.
- [ ] **Step 2: Tes API (Review Focus #5)** — script `scripts/check-psikolog-views.ts` (tsx) memanggil `toPsikologBookingView` pada fixture booking lengkap dan `assert` hasil JSON tidak mengandung key `nama_lengkap|email|no_wa|kontak_darurat`. Pastikan semua route booking/sesi/catatan untuk role psikolog memakai helper ini.
- [ ] **Step 3:** tsc + build. Commit.

### Task B8: Rating, ulasan publik, tip sesi

**Files:**
- Create: `supabase/migrations/20261017000017_session_reviews.sql`, `supabase/tests/session_reviews_dryrun.sql`, `src/app/api/bookings/[id]/review/route.ts` (PUT), `src/app/api/bookings/[id]/tip/route.ts` (POST), `src/app/api/psychologists/[id]/reviews/route.ts` (GET publik), `src/app/api/admin/reviews/[id]/route.ts` (PATCH hide), `src/app/api/bookings/[id]/review/report/route.ts` (POST, psikolog)
- Modify: `src/app/api/psychologists/route.ts` & `[id]/route.ts` (tambah `rating_avg`, `rating_count`, `attendance_pct`)

**Interfaces — Produces:**
- Tabel `session_reviews(booking_id pk, patient_id, psikolog_id, rating smallint 1–5, review text ≤500 null, is_hidden bool default false, reported_at null, created_at, updated_at)`.
- `public.review_upsert(p_booking_id, p_patient_id, p_rating smallint, p_review text)` — hanya booking `completed` milik pasien, dalam `rating.window_days` sejak `ended_at`.
- `public.session_tip(p_tip_id, p_booking_id, p_patient_id, p_coins)` — cek booking `completed` milik pasien & dalam jendela, lalu panggil `tip_create(..., 'session', p_booking_id)` yang ada.
- Agregat: `rating_avg` = avg rating tidak hidden; tampil `null` jika `count < rating.min_count_to_show`. Ulasan publik: `{ rating, review, month: 'Okt 2026' }` tanpa identitas.

- [ ] **Step 1: Dry-run (tes)** — review booking `no_show` → gagal; review hari ke-8 → gagal; upsert 2× → 1 baris; tip 2× → `tips_source_once` menolak yang kedua; 2 rating → avg null, 3 rating → avg terisi.
- [ ] **Step 2:** Implement + routes. tsc + build. Commit.

### Task B9: Notifikasi di aplikasi

**Files:**
- Create: `supabase/migrations/20261017000018_notifications.sql`, `supabase/tests/notifications_dryrun.sql`, `src/app/api/notifications/route.ts` (GET), `src/app/api/notifications/read/route.ts` (POST)
- Modify: RPC B4–B8 (lewat `CREATE OR REPLACE` di migrasi ini) untuk memanggil `notify_internal`.

**Interfaces — Produces:**
- Tabel `notifications(id, user_id, type text, title text, body text, link text null, read_at null, created_at)`; RLS SELECT/UPDATE pemilik; realtime publication.
- `public.notify_internal(p_user_id, p_type, p_title, p_body, p_link)`.
- Type: `booking_new`, `booking_cancelled`, `psikolog_cancelled_choice`, `session_reminder_60`, `session_reminder_10`, `session_started`, `tip_received`, `strike_added`, `suspended` (+ admin).
- Pengingat 60/10 menit dikirim oleh `session_tick()` (kolom `reminded_60_at`, `reminded_10_at` di bookings agar tidak ganda).

- [ ] **Step 1: Dry-run (tes)** — booking_create → 1 notifikasi `booking_new` untuk psikolog; `session_tick` 2× di jendela 10 menit → tepat 1 `session_reminder_10` per peserta.
- [ ] **Step 2:** Implement + routes. tsc + build. Commit.

### Task B10: Hapus media sesi setelah 30 hari

**Files:** `src/app/api/cron/purge-session-media/route.ts`, `supabase/migrations/20261017000019_purge_media_cron.sql`, `supabase/tests/purge_media_dryrun.sql`

**Interfaces:** Route POST dilindungi header `x-cron-secret` = env baru `CRON_SECRET` (bandingkan dengan `timingSafeEqual`); ambil `session_messages` dengan `media_path` dari booking yang `ended_at/cancelled_at < now() - media_retention.days`, hapus file via `supabaseAdmin.storage.from('session-media').remove()`, lalu set `media_path = NULL`, `body = '[media dihapus]'`. Dijadwalkan harian via pg_cron + `pg_net.http_post` ke `NEXT_PUBLIC_APP_URL` (jika pg_net tidak tersedia: STOP dan lapor; alternatif Vercel Cron).

- [ ] **Step 1: Tes** — panggil tanpa/dengan secret salah → 401; dengan fixture media lama → baris ter-update, file baru tetap.
- [ ] **Step 2:** tsc + build. Commit. Tambah `CRON_SECRET` ke `.env.example`.

---

## Bagian FE (Rimuru)

Setiap task FE: hanya file FE; data dari API task BE terkait (sudah merge); tampilkan error server; tsc + build; kirim daftar halaman untuk dicek konsultan di browser.

### Task F1: Jadwal psikolog (ganti ComingSoon `/counselor/schedule`)
Butuh B2. Editor pola mingguan (7 hari, tambah/hapus rentang jam bulat), daftar libur (tambah dengan tanggal + jam, tampilkan peringatan `conflicting_bookings`), toggle "Jeda terima booking", input harga ekstensi (rentang dari public settings `extension_price`) di Pengaturan psikolog.

### Task F2: Cari & booking psikolog (pasien)
Butuh B3, B4, B8 (agregat). Daftar psikolog (label spesialisasi, rating/"Psikolog baru", tingkat kehadiran, harga koin) → profil (ulasan publik) → pilih tanggal (deret 14 hari) & jam dari `/slots` → modal keluhan (20–1000) + ringkasan harga & saldo → `POST /api/bookings`. Tangani 409 `SLOT_UNAVAILABLE` (muat ulang slot), 402 (arahkan ke Top Up).

### Task F3: Jadwal saya (pasien) + daftar booking (psikolog)
Butuh B4, B5. Pasien `/patient/schedule`: upcoming & riwayat, batal (tampilkan estimasi refund dari tier), pindah jadwal (hanya jika memenuhi aturan), layar pilihan setelah psikolog batal (pindah slot / refund). Psikolog beranda "Janji temu" & daftar booking dengan tombol batal (peringatan strike bila <24 jam). Ganti angka "Belum ada" di beranda psikolog dengan data nyata.

### Task F4: Ruang sesi (pasien & psikolog)
Butuh B6a, B6b, B7. Ganti ComingSoon `/counselor/room`; halaman sesi pasien. Chat realtime (subscribe `session_messages` per booking), kirim teks/gambar/VN, timer sisa waktu (45 / +10), banner keluhan untuk psikolog, tombol ajukan ekstensi (pasien) & setujui/tolak (psikolog), tombol "Akhiri sesi" (psikolog), panel catatan klien di samping (psikolog). Setelah selesai → read-only.

### Task F5: Setelah sesi & riwayat
Butuh B8. Layar akhir sesi: rating (opsional), ulasan (≤500, peringatan info pribadi), tip (min/maks dari settings) ; riwayat sesi read-only + "Booking lagi" (ke profil psikolog yang sama). Psikolog: tombol laporkan ulasan.

### Task F6: Catatan klien psikolog (ganti ComingSoon `/counselor/clients`)
Butuh B7. Daftar pasien (display name) → catatan per sesi, terbaru di atas.

### Task F7: Notifikasi & admin
Butuh B1, B5, B8, B9. Dropdown notifikasi nyata (realtime, tandai dibaca). Admin: grup pengaturan baru (B1 sudah sebagian), ringkasan strike di modal detail psikolog, moderasi ulasan (sembunyikan).

---

## Urutan & alur kerja

1. B1 → B2 → B3 → B4 → B5 → B6a → B6b → B7 → B8 → B9 → B10 (Paul, berurutan; tiap task: review konsultan → dry-run & migrasi oleh Bang Wahyu → merge ff).
2. FE mulai setelah BE dependensinya merge: F1 (setelah B2), F2 (B4; agregat rating menyusul B8), F3 (B5), F4 (B7), F5 & F6 (B8), F7 (B9). Paul & Rimuru bisa paralel.
3. Merge: dari folder yang sedang checkout master, `--ff-only`, lalu kembali ke branch kerja.
4. Setelah F4: uji end-to-end oleh konsultan di browser dengan akun test (pasien, psikolog) — top-up → booking → sesi → selesai → earning holding.
