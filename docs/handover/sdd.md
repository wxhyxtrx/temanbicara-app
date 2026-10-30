# SDD — Model data & RPC TemanBicara

Status per 2026-10-30 · migrasi s.d. `000026` sudah diterapkan di Supabase DEV (`mcciuvlqvvvptgmelexi`). Sumber kebenaran: folder `supabase/migrations/`. Kalau dokumen ini beda dengan migrasi, **migrasi yang benar** — laporkan ke SA.

## Aturan arsitektur & restriksi keamanan database (wajib)

- Semua tulis data penting lewat **RPC** `SECURITY DEFINER` + `SET search_path = ''`; `REVOKE` dari PUBLIC/anon/authenticated, `GRANT EXECUTE` ke `service_role`. API route memanggil RPC dengan service client.
- RLS aktif di semua tabel; admin dicek dengan `public.is_admin()` (`SECURITY DEFINER`).
- Uang: ledger **append-only** lewat `apply_wallet_ledger_internal` (idempoten: unique `(reason, ref_type, ref_id, account)`). Jangan pernah `UPDATE wallets` langsung.
- Data booking ke psikolog wajib lewat `toPsikologBookingView` (sembunyikan nama asli/kontak pasien).
- Angka bisnis dibaca dari `system_settings`, jangan di-hardcode.
- Migrasi baru: nomor urut berikutnya (`000027_...`), uji dry-run `BEGIN … ROLLBACK` dulu; SA/Pengawas yang menerapkan ke remote Supabase.
- **Pencabutan Hak Tulis Publik (Revocation Tabel Public)**: Role `anon` dan `authenticated` dicabut seluruh hak `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` pada semua tabel di skema `public`. Mutasi data hanya diperbolehkan melalui fungsi RPC yang dijalankan dengan hak `service_role`.
- **Column-Level Grant Anonimitas**: Tabel `public.peer_tickets` dicabut hak `SELECT` penuhnya dari `anon` dan `authenticated`. Role `authenticated` hanya diberikan hak `SELECT` terbatas pada 16 kolom non-sensitif (`id`, `patient_alias`, `topic`, `emotion`, `content`, `is_anonymous`, `status`, `claimed_by`, `claimed_at`, `first_response_at`, `closed_at`, `closed_by`, `archived_at`, `abandoned_by`, `created_at`, `updated_at`). Kolom `patient_id` tidak dapat diakses langsung oleh relawan atau pengguna lain melalui PostgREST/Realtime.
- **RLS Helper Berstatus SECURITY DEFINER**: Helper function `public.is_peer_ticket_participant(p_ticket_id UUID)` berjalan dengan `SECURITY DEFINER` dan `SET search_path = ''` untuk memvalidasi apakah pengguna aktif adalah pasien pembuat tiket atau relawan pengklaim tanpa mengekspos `patient_id`. Helper ini di-grant ke `authenticated` dan `service_role` serta dipakai oleh policy `peer_messages_select_participant` pada tabel `public.peer_messages`.
- **Pencabutan Eksekusi Trigger Function (Trigger Revocation)**: Hak `EXECUTE` pada seluruh fungsi trigger berstatus `SECURITY DEFINER` dicabut dari `PUBLIC`, `anon`, dan `authenticated`.
- **Default Privileges Host (Postgres)**: Dikonfigurasi eksplisit pada role `postgres` di skema `public` (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated`, `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`, `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated`, dan `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated`).
- **Jaring Pengaman service_role**: `GRANT ALL ON ALL TABLES/FUNCTIONS/SEQUENCES IN SCHEMA public TO service_role` untuk memastikan seluruh operasi backend API, admin, dan background cron berjalan tanpa hambatan.

## Enum

| Enum | Nilai |
| --- | --- |
| `user_role` | pasien, relawan, psikolog, admin |
| `account_status` | active, unverified_email, incomplete_profile, pending_approval, pending_verification, rejected, suspended |
| `payment_status` | pending, settlement, deny, expire, cancel, refund |
| `peer_ticket_status` | open, claimed, active, closed, archived |
| (legacy, tidak dipakai) | verification_status, session_status, peer_status, crisis_risk_level |

## Tabel

### Pengguna & profil
| Tabel | Kolom penting |
| --- | --- |
| `users` | id (= auth.users.id), email, no_wa, google_id, role, status, avatar_url, is_email_verified |
| `admin_profiles` | user_id, nama_lengkap, level |
| `pasien_profiles` | user_id, nama_lengkap, nama_panggilan, kontak_darurat_nama, kontak_darurat_wa, is_anonim_default |
| `psikolog_profiles` | user_id, nama_lengkap_gelar, nomor_sipp_str, dokumen_sipp_str_url, spesialisasi text[], tahun_pengalaman, tarif_sesi, verified_at, rejection_reason, booking_paused, extension_price_coins, suspended_until, `saldo` (legacy, jangan dipakai) |
| `relawan_profiles` | user_id, nama_lengkap, latar_belakang, dokumen_cv_url, alasan_bergabung, total_sesi, alias_name, is_available, topik_keahlian text[], rating_rata_rata |

### Curhat sebaya & relawan
| Tabel | Kolom penting & catatan |
| --- | --- |
| `peer_tickets` | `id` (UUID PK), `patient_id` (UUID FK auth.users, terlindungi column grant), `patient_alias` (TEXT), `topic` (TEXT), `emotion` (TEXT), `content` (TEXT max 1000), `is_anonymous` (BOOLEAN default true), `status` (peer_ticket_status: 'open', 'claimed', 'active', 'closed', 'archived'), `claimed_by` (UUID FK auth.users), `claimed_at` (TIMESTAMPTZ), `first_response_at` (TIMESTAMPTZ), `closed_at` (TIMESTAMPTZ), `closed_by` (TEXT: 'pasien' \| 'relawan' \| 'system'), `archived_at` (TIMESTAMPTZ), `abandoned_by` (UUID[]), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ). RLS aktif; relawan membaca via 16 kolom non-sensitif yang di-grant (tanpa `patient_id`). Partial unique index menjamin maksimal 1 tiket aktif (`open`, `claimed`, `active`) per pasien. |
| `relawan_daily_quota` | `relawan_id` (UUID FK auth.users), `quota_date` (DATE WIB), `tickets_claimed` (INT default 0), `penalty_points` (INT default 0). PK: `(relawan_id, quota_date)`. Kuota default 3 tiket per hari (WIB); klaim timeout (10 menit) memotong kuota dan menambah penalti; carry penalty keesokan harinya jika total konsumsi melebihi batas harian. |
| `peer_messages` | `id` (UUID PK), `ticket_id` (UUID FK peer_tickets ON DELETE CASCADE), `sender_id` (UUID FK users), `kind` (TEXT check: 'text' \| 'image' \| 'voice'), `body` (TEXT max 4000), `media_path` (TEXT ke bucket session-media), `duration_seconds` (INTEGER), `created_at` (TIMESTAMPTZ). Realtime aktif; RLS SELECT menggunakan helper `public.is_peer_ticket_participant(ticket_id) OR public.is_admin()`. Mutasi PostgREST dicabut penuh dari anon/authenticated (hanya via RPC/service_role). |
| `peer_reviews` | `ticket_id` (UUID PK FK peer_tickets ON DELETE CASCADE), `patient_id` (UUID FK users), `relawan_id` (UUID FK users), `rating` (SMALLINT 1–5), `review` (TEXT max 500), `is_hidden` (BOOLEAN default false), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ). Ditulis pasien setelah tiket berstatus closed (dalam jendela rating.window_days, default 7 hari). |

### Jadwal & disiplin psikolog
| Tabel | Kolom penting |
| --- | --- |
| `psikolog_schedules` | psikolog_id, weekday, start_hour, end_hour (WIB) |
| `psikolog_time_off` | psikolog_id, start_at, end_at, reason |
| `psikolog_strikes` | psikolog_id, booking_id, points, reason (`late_cancel` \| `noshow`) |

### Booking & sesi
| Tabel | Kolom penting |
| --- | --- |
| `bookings` | id, patient_id, psikolog_id, start_at, status, keluhan, price_coins, mitra_share_bps, extension_price_coins, refund_policy jsonb (snapshot saat booking), patient_display_name, reschedule_count, psikolog_first_msg_at, patient_first_msg_at, psikolog_late, extension_status, extension_coins, ended_at, cancelled_at, choice_deadline_at, refund_coins, reminded_60_at, reminded_10_at |
| `session_messages` | booking_id, sender_id, kind (`text` \| `image` \| `voice`), body, media_path, duration_seconds |
| `client_notes` | booking_id (PK), psikolog_id, patient_id, body (≤ 5000) — hanya penulis yang bisa baca |
| `session_reviews` | booking_id (PK), patient_id, psikolog_id, rating 1–5, review (≤ 500), is_hidden, reported_at |
| `notifications` | user_id, type, title, body, link, read_at (realtime) |
| `emergency_contact_access_log` | admin_id, patient_id, waktu akses |

### Dompet & uang
| Tabel | Kolom penting |
| --- | --- |
| `wallets` | user_id, coin_balance, pending_rupiah, available_rupiah |
| `ledger_entries` | user_id, account (`patient_coins` \| `mitra_pending` \| `mitra_available` \| `platform_revenue` \| `payout_disbursement`), amount, unit (`coin` \| `rupiah`), reason, ref_type, ref_id |
| `mitra_earnings` | mitra_id, amount_rupiah, source_type (`tip` \| `session` \| `extension` \| `refund_share`), source_id, available_at, released_at |
| `tips` | patient_id, mitra_id, coins, mitra_share_bps, source_type (`session` \| `ticket`), source_id |
| `topup_orders` | order_id, patient_id, coins, amount_rupiah, status (payment_status), provider_reference, settled_at, expires_at, snap_redirect_url |
| `payout_requests` | mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status (`requested` \| `paid` \| `rejected`), decided_by |

### Pengaturan
| Tabel | Isi |
| --- | --- |
| `system_settings` | key, value jsonb, updated_by |
| `system_settings_audit` | riwayat perubahan (diff) |

Kunci `system_settings` (default): `booking` {min_hours_before 2, max_days_ahead 14, max_active_per_patient 3, max_per_psikolog_per_day 1, reschedule_min_hours 24, psikolog_cancel_free_hours 24, choice_deadline_hours 48} · `strike` {threshold 3, window_days 30, suspend_days 7, per_late_cancel 1, per_noshow 2} · `rating` {window_days 7, min_count_to_show 3} · `revenue_share` {mitra_bps 8000} · `holding` {hours 48} · `psikolog_late` {minutes 10} · `patient_noshow` {minutes 30} · `refund_policy` (tier) · `tip` (1–50, batas harian 100) · `topup` (10–500 koin) · `payout` {min 500000, max 10000000, fee 6500} · `extension_price` (1–10 koin) · `upload` {chat_media_max_mb 10, verification_max_mb 5, voice_note_max_seconds 180} · `media_retention` {days 30} · `relawan` {daily_ticket_quota 3, claim_response_minutes 10, unclaimed_archive_hours 24, max_carry_penalty 1} · `maintenance`.

## Alur status booking

```mermaid
stateDiagram-v2
  [*] --> booked: booking_create (koin dipotong)
  booked --> in_progress: pesan pertama psikolog
  booked --> cancelled_by_patient: booking_cancel_by_patient (refund 100/65/0%)
  booked --> awaiting_patient_choice: booking_cancel_by_psikolog (+strike bila < 24 jam)
  booked --> auto_cancelled_late: psikolog tak menyapa 10 mnt (refund 100%, 2 strike)
  booked --> booked: booking_reschedule (1x, > 24 jam)
  awaiting_patient_choice --> cancelled_by_psikolog: booking_choose_refund / lewat batas 48 jam (refund 100%)
  awaiting_patient_choice --> booked: booking_reschedule
  in_progress --> completed: session_end / tutup paksa menit 58
  in_progress --> no_show: pasien tak hadir 30 mnt (refund 0%)
  completed --> [*]
```

Ekstensi (`extension_status`): `requested` → `approved` (koin pasien dipotong, +10 menit) atau `declined`. Settlement uang ke mitra terjadi di `booking_settle_internal` (80% ke `mitra_pending`, cair setelah 48 jam oleh `release_holding`).

## RPC

| Grup | Fungsi (parameter) → hasil |
| --- | --- |
| Admin | `is_admin()` → bool · `admin_dashboard_stats(p_today_start)` → jsonb · `update_system_settings_batch(p_entries jsonb, p_user_id)` · `notify_internal(user, type, title, body, link)` → uuid |
| Curhat sebaya & relawan | `peer_ticket_create(p_patient_id UUID, p_alias TEXT, p_topic TEXT, p_emotion TEXT, p_content TEXT, p_is_anon BOOLEAN)` → `public.peer_tickets` · `peer_ticket_claim(p_ticket_id UUID, p_relawan_id UUID)` → `public.peer_tickets` · `peer_ticket_first_response(p_ticket_id UUID, p_relawan_id UUID)` → `public.peer_tickets` · `peer_ticket_close(p_ticket_id UUID, p_user_id UUID)` → `public.peer_tickets` · `peer_ticket_tick()` → `JSONB` (cron per menit: timeout klaim 10m, auto-archive tiket unclaimed 24j, auto-close ruang dengar 24j) · `peer_review_create(p_ticket_id UUID, p_patient_id UUID, p_rating INT, p_review TEXT)` → `public.peer_reviews` · `peer_ticket_tip(p_tip_id UUID, p_ticket_id UUID, p_patient_id UUID, p_coins BIGINT)` → `VOID` (memicu `tip_create` → `UUID`) · `peer_rating_summary(p_relawan_id UUID)` → `TABLE(rating_avg NUMERIC, rating_count BIGINT)` · `peer_media_mark_purged(p_message_ids UUID[])` → `INTEGER` |
| Booking | `booking_create(p_booking_id, p_patient_id, p_psikolog_id, p_start_at, p_keluhan)` → bookings · `booking_cancel_by_patient(booking, patient)` · `booking_cancel_by_psikolog(booking, psikolog)` · `booking_choose_refund(booking, patient)` · `booking_reschedule(booking, patient, new_start_at)` (semua → bookings) · `booking_settle_internal(booking, outcome)` |
| Sesi | `session_end(booking, psikolog)` → bookings · `extension_request(booking, patient)` → bookings · `extension_respond(booking, psikolog, approve)` → `'approved'` \| `'declined'` \| `'insufficient_coins'` · `client_note_upsert(booking, psikolog, body)` · `session_tick()` → int (pg_cron tiap menit) · `session_media_mark_purged(uuid[])` → int |
| Jadwal | `psikolog_available_slots(psikolog, from, to)` → setof timestamptz · `psikolog_schedule_replace(psikolog, p_weekly jsonb)` · `apply_strike_suspension(psikolog_id)` |
| Ulasan & tip | `review_upsert(booking, patient, rating, review)` · `review_report(booking, psikolog)` · `review_set_hidden(booking, is_hidden)` · `psikolog_rating_summary(psikolog)` → (rating_avg, rating_count) · `session_tip(tip_id, booking, patient, coins)` · `tip_create(tip_id, patient, mitra, coins, source_type, source_id)` |
| Dompet | `apply_wallet_ledger_internal(user, account, delta, unit, reason, ref_type, ref_id)` · `topup_order_create(order_id, patient, coins, expires_at)` → uuid · `topup_attach_snap(order_id, redirect_url)` · `topup_settle(order_id, provider_ref, paid_amount)` · `topup_fail(order_id, status, provider_ref)` · `topup_expire_stale(batch)` → int · `release_holding(batch)` → int · `payout_request(payout_id, mitra, amount, bank_name, account_number, account_name)` · `payout_mark_paid(payout, admin)` · `payout_reject(payout, admin)` |

## Job terjadwal

| Job | Jadwal | Isi |
| --- | --- | --- |
| pg_cron `session-tick` | tiap menit | `session_tick()` — pengingat, auto-cancel, no-show, tutup paksa, refund otomatis (error per baris ditangkap) |
| pg_cron `peer-ticket-tick-job` | `* * * * *` (tiap menit) | `public.peer_ticket_tick()` — timeout tiket klaim tak dijawab (10m) kembali ke antrean pool dengan penalti kuota relawan, auto-archive tiket unclaimed (24j), auto-close ruang dengar aktif melebihi 24 jam |
| pg_cron `release-holding-job` | berkala | `release_holding` — cairkan pendapatan mitra setelah 48 jam |
| pg_cron `topup-expire-stale-job` | berkala | `topup_expire_stale` |
| Vercel Cron `/api/cron/purge-session-media` | `0 19 * * *` (02.00 WIB) | hapus media sesi > 30 hari; mencakup media sesi konseling (`session_messages` via `session_media_mark_purged`) dan media curhat sebaya (`peer_messages` via `peer_media_mark_purged`); butuh header `CRON_SECRET` |

## Auth & sesi login

Cookie: `tb_access_token` (JWT, non-httpOnly), `tb_refresh_token` (httpOnly), `tb_user_role` (ditandatangani `ROLE_COOKIE_SECRET`), `tb_user_status`. Klien kena 401 → coba `/api/auth/refresh` sekali → gagal = logout. Realtime butuh `supabasePublic.realtime.setAuth(token)` + polling cadangan.

## Riwayat migrasi (s.d. 000026)

| Migrasi | File | Deskripsi ringkas |
| --- | --- | --- |
| `000001` | `20261014000001_system_settings.sql` | Pengaturan sistem, audit key-value |
| `000002` | `20261014000002_wallet_ledger.sql` | Dompet, buku besar append-only, payout |
| `000003` | `20261016000003_release_holding_cron.sql` | Holding period 48 jam & pg_cron |
| `000004` | `20261016000004_topup_expiry_and_history.sql` | Kedaluwarsa topup otomatis & audit order |
| `000005` | `20261016000005_topup_attach_snap.sql` | Snap redirect URL untuk payment gateway |
| `000006` | `20261016000006_admin_dashboard_stats.sql` | RPC ringkasan metrik dashboard admin |
| `000007` | `20261016000007_relawan_profiles_and_dokumen_mitra.sql` | Profil relawan & dokumen mitra verifikasi |
| `000008` | `20261017000008_pasien_profile_fields.sql` | Bidang kontak darurat & opsi anonim pasien |
| `000009` | `20261017000009_booking_settings.sql` | Pengaturan kebijakan booking & jadwal |
| `000010` | `20261017000010_psikolog_schedule.sql` | Jadwal mingguan & time-off psikolog |
| `000011` | `20261017000011_available_slots.sql` | RPC ketersediaan slot konseling |
| `000012` | `20261017000012_bookings.sql` | Siklus booking konseling & settlement koin |
| `000013` | `20261017000013_psikolog_cancel_strikes.sql` | Sistem strike & penalti pembatalan psikolog |
| `000014` | `20261017000014_session_messages.sql` | Pesan teks, gambar, VN sesi konseling |
| `000015` | `20261017000015_session_lifecycle.sql` | Ekstensi sesi, penutupan, & cron session_tick |
| `000016` | `20261017000016_client_notes.sql` | Catatan klinis privat psikolog |
| `000017` | `20261017000017_session_reviews.sql` | Ulasan sesi konseling pasien & agregat rating |
| `000018` | `20261017000018_notifications.sql` | Notifikasi realtime dalam aplikasi |
| `000019` | `20261017000019_purge_media.sql` | Pembersihan berkas media sesi kedaluwarsa 30 hari |
| `000020` | `20261021000020_peer_tickets.sql` | Tabel `peer_tickets`, `relawan_daily_quota`, RPC `peer_ticket_create`, `peer_ticket_claim`, `peer_ticket_first_response`, `peer_ticket_tick` |
| `000021` | `20261021000021_peer_ticket_cron.sql` | Ekstensi `pg_cron` dan penjadwalan job `peer-ticket-tick-job` per menit |
| `000022` | `20261022000022_peer_messages.sql` | Tabel `peer_messages`, publikasi Realtime, RLS participant |
| `000023` | `20261022000023_security_revocations_k1_t2.sql` | Pencabutan hak mutasi PostgREST tabel profil & pesan, penyesuaian RLS |
| `000024` | `20261022000024_peer_closure_reviews.sql` | Tabel `peer_reviews`, kolom `closed_by`, RPC `peer_ticket_close`, `peer_review_create`, `peer_ticket_tip`, `peer_rating_summary`, auto-close 24 jam pada `peer_ticket_tick` |
| `000025` | `20261022000025_peer_media_purge.sql` | RPC `peer_media_mark_purged` untuk pembersihan media pesan sebaya > 30 hari |
| `000026` | `20261022000026_database_permissions_hardening.sql` | Pengerasan izin database: pencabutan mutasi tabel public dari anon/authenticated, column grant anonimitas 16 kolom `peer_tickets`, RLS helper `is_peer_ticket_participant`, pencabutan eksekusi trigger function, default privileges host `postgres`, jaring pengaman `service_role` |
