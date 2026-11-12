# Usulan Teknis: Mekanisme Penahanan Otomatis Payout Mitra atas Kasus Refund & Chargeback Top-Up (Q2 Opsi A)

- **Dokumen:** Dokumen Usulan Arsitektur & Analisis Serah Terima (Handover)
- **Status:** Usulan Teknis (Tahap Evaluasi Arsitektur)
- **Rujukan:** PRD-049 (`prd/PRD-049-midtrans-payment-fixes.md`), Keputusan Desain Kapten 2026-11-12, Tiket T-211
- **Penulis:** Paul (Lead Backend Engineer & System Architect)
- **Terkait:** `wallets`, `ledger_entries`, `topup_orders`, `bookings`, `tips`, `mitra_earnings`, `payout_requests`, `WalletPayoutService`

---

## 1. Latar Belakang & Masalah Bisnis

### 1.1 Masalah Finansial Sengketa Pembayaran (Chargeback/Refund)
Pada ekosistem TemanBicara, pasien membeli koin layanan (1 koin = Rp 10.000) melalui payment gateway Midtrans (`topup_orders`). Koin yang diperoleh pasien kemudian digunakan untuk:
1. Membayar pemesanan sesi konseling psikolog (`bookings`, `reason = 'booking_payment'`).
2. Membayar perpanjangan sesi konsultasi (`bookings`, `reason = 'extension_payment'`).
3. Memberikan tip apresiasi kepada psikolog atau relawan (`tips`, `reason = 'tip_debit'`).

Setiap transaksi tersebut memotong saldo `coin_balance` pasien dan mengalokasikan bagi hasil (default 80% mitra, 20% platform) ke akun penampungan sementara `mitra_pending` di tabel `mitra_earnings` dengan masa penahanan (*holding period*) 48 jam. Setelah masa penahanan lewat, cron/RPC `release_holding` memindahkan saldo dari `mitra_pending` ke `mitra_available`. Mitra kemudian dapat mencairkan saldo tersebut ke rekening bank melalui pengajuan `payout_requests` (`WalletPayoutService.requestPayout`).

**Titik Kritis:**
Ketika terjadi sengketa pembayaran di sisi bank penerbit kartu/Midtrans (*chargeback* atau permintaan *refund* resmi):
- Dana riil di rekening penampung (*merchant account*) Midtrans TemanBicara ditarik kembali (*debited*) oleh Midtrans/bank secara sepihak.
- Jika koin hasil top-up tersebut sudah digunakan pasien untuk sesi konseling dan mitra telah/sedang mencairkan honor tersebut ke rekening pribadinya, maka kas riil TemanBicara berpotensi mengalami **kerugian ganda (double loss / deficit)**:
  1. Kehilangan pendapatan riil dari top-up (karena ditarik bank/Midtrans).
  2. Mengeluarkan dana kas riil untuk membayar payout mitra atas sesi yang koinnya bodong/disengketakan.

### 1.2 Keputusan Desain Kapten (2026-11-12)
Untuk menjaga stabilitas operasional dan kepastian hukum, Kapten telah menetapkan dua prinsip dasar:
1. **Penanganan Koin Pasien (Q1 Opsi B):**
   Saat webhook `refund` atau `chargeback` diterima, koin pasien **TIDAK ditarik otomatis** dari wallet pasien. Status `topup_orders` ditandai menjadi `'refund'` atau `'chargeback'`, dan penyesuaian koin pasien diserahkan kepada penanganan administratif manual admin per kasus.
2. **Penahanan Payout Mitra (Q2 Opsi A):**
   Payout mitra **wajib ditahan secara otomatis** jika pengajuan pencairan menyangkut koin dari order top-up yang berstatus `refund` atau `chargeback` yang belum diselesaikan (*cleared*) oleh admin.

Dokumen ini merumuskan analisis keterlacakan koin dari hulu ke hilir dan membandingkan opsi implementasi penahanan payout mitra secara otomatis tanpa merusak integritas buku besar kekal (*append-only ledger*).

---

## 2. Audit Arsitektur Dompet & Buku Besar Saat Ini

### 2.1 Model Data Saat Ini
Berdasarkan migrasi `20261014000002_wallet_ledger.sql`, `20261017000012_bookings.sql`, dan `20261017000015_session_lifecycle.sql`, komponen data moneter terdiri dari:

```
[ Midtrans Topup ]
       │
       ▼
 [ topup_orders ] ──────────────► [ ledger_entries ] (account: patient_coins, unit: coin)
       │                                  │
       │ (Koin terkumpul di dompet)       ▼
       ▼                            [ wallets ] (coin_balance)
 [ bookings / tips ] ───────────► [ ledger_entries ] (account: patient_coins, unit: coin, amount: -N)
       │
       ├────────────────────────► [ ledger_entries ] (account: platform_revenue, unit: rupiah, 20%)
       │
       ▼
 [ mitra_earnings ] ────────────► [ ledger_entries ] (account: mitra_pending, unit: rupiah, 80%)
 (holding 48 jam)                         │
       │                                  ▼
       │ (release_holding)          [ wallets ] (pending_rupiah)
       ▼                                  │
 [ ledger_entries ] ◄─────────────────────┘
 (mitra_pending -> mitra_available)
       │
       ▼
 [ wallets ] (available_rupiah)
       │
       ▼ (payout_request)
 [ payout_requests ] ───────────► [ ledger_entries ] (account: mitra_available, amount: -(payout+fee))
```

1. **`public.wallets`**:
   - `coin_balance` (BIGINT, unit: coin, hanya role pasien).
   - `pending_rupiah` (BIGINT, unit: rupiah, hanya role mitra).
   - `available_rupiah` (BIGINT, unit: rupiah, hanya role mitra).
   - Tidak boleh di-`UPDATE` langsung oleh aplikasi; mutasi hanya boleh terjadi melalui RPC `SECURITY DEFINER`.

2. **`public.ledger_entries`**:
   - Buku besar berbasis *append-only*.
   - Trigger `ledger_entries_immutable` mengeksekusi `reject_ledger_mutation()` yang melempar exception `LEDGER_APPEND_ONLY` pada setiap operasi `UPDATE` atau `DELETE`.
   - Menjamin bahwa tidak ada riwayat transaksi yang dapat diubah atau dihapus secara retroaktif.

3. **`public.topup_orders`**:
   - Mencatat pesanan top-up: `order_id`, `patient_id`, `coins`, `amount_rupiah`, `status` (`pending`, `settlement`, `deny`, `expire`, `cancel`, `refund`, `chargeback`).

4. **`public.mitra_earnings`**:
   - Mencatat pendapatan per unit layanan: `mitra_id`, `amount_rupiah`, `source_type` (`session`, `extension`, `tip`, `refund_share`), `source_id`, `available_at`, `released_at`.
   - Constraint unik: `CONSTRAINT mitra_earning_source_once UNIQUE (source_type, source_id)`.

5. **`public.payout_requests`**:
   - Pengajuan penarikan dana: `id`, `mitra_id`, `amount_rupiah`, `fee_rupiah`, `bank_name`, `account_number`, `bank_account_name`, `status` (`requested`, `paid`, `rejected`), `requested_at`, `decided_at`, `decided_by`.
   - Pada saat pengajuan, saldo `wallets.available_rupiah` langsung dipotong sebesar `amount_rupiah + fee_rupiah` dan dicatat di ledger sebagai `reason = 'payout_reserved'`. Jika ditolak admin, RPC `payout_reject` mengembalikan dana ke `available_rupiah` (`reason = 'payout_rejected_refund'`).

---

## 3. Analisis Keterlacakan Koin (Coin Tracing Analysis)

### 3.1 Tantangan: Fungible Balance Pool vs UTXO/Lot Tracking
Tantangan teknis fundamental dalam sistem TemanBicara saat ini adalah:
- Saldo koin pasien di tabel `wallets.coin_balance` bersifat **fungible balance pool** (seperti air dalam satu tangki).
- Tabel `bookings` dan `tips` hanya mencatat `price_coins` dan `patient_id`, tanpa menyimpan referensi langsung ke `topup_order_id` yang mendanai koin tersebut.

**Contoh Kasus Multi-Topup:**
1. Pasien melakukan Top-up A (10 koin) pada 1 November. Status: `settlement`.
2. Pasien melakukan Top-up B (30 koin) pada 2 November. Status: `settlement`.
   *Total saldo koin pasien = 40 koin.*
3. Pasien memesan Sesi Konseling Psikolog X seharga 25 koin pada 3 November.
4. Pada 5 November, Midtrans mengirimkan notifikasi `chargeback` untuk **Top-up B**.

*Pertanyaan:* Apakah Sesi Konseling Psikolog X menggunakan koin dari Top-up A atau Top-up B?
Jawaban atas pertanyaan ini bergantung pada model akuntansi penelusuran yang diadopsi.

---

### 3.2 Pemodelan Keterlacakan Alur Koin

Terdapat tiga pendekatan utama untuk melacak hubungan antara `topup_orders` bermasalah dengan `mitra_earnings`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODEL PENELUSURAN KOIN                          │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│ 1. FIFO Virtual Ledger  │ 2. Taint Overlap Window │ 3. Explicit Lot    │
│    (Query Reconstruction│    (Conservative Heuris)│    Allocation      │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ Melacak alur kronologis │ Menandai sesi dalam     │ Mencatat relasi    │
│ debit vs kredit di      │ jendela waktu aktif     │ topup_id langsung  │
│ ledger_entries secara   │ order sengketa          │ saat booking/tip   │
│ matematis FIFO          │                         │                    │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

#### Pendekatan 1: Rekonstruksi Kronologis FIFO Virtual (Virtual FIFO Tracking)
- **Mekanisme:**
  Sistem melakukan evaluasi *replay* terhadap mutasi ledger `patient_coins` untuk pasien yang bersangkutan:
  1. Urutkan seluruh kredit koin (`amount > 0`, yaitu `topup_order` dan `booking_cancel_refund`) berdasarkan `created_at ASC`.
  2. Urutkan seluruh debit koin (`amount < 0`, yaitu `booking_payment`, `extension_payment`, `tip_debit`) berdasarkan `created_at ASC`.
  3. Alokasikan debit koin ke kredit koin menggunakan metode First-In, First-Out (FIFO).
  4. Jika porsi debit jatuh pada kredit yang berasal dari `topup_order` berstatus `refund` atau `chargeback`, maka transaksi debit tersebut ditandai sebagai **terkontaminasi (*tainted*)**.
  5. Tarik `mitra_earnings` yang berkorespondensi dengan debit terkontaminasi (`source_type = 'session'` / `'extension'` dengan `source_id = booking_id`, atau `source_type = 'tip'` dengan `source_id = tip_id`).
- **Kelebihan:**
  - Akurat secara matematis dan mencerminkan urutan penggunaan uang riil secara wajar.
  - Tidak memerlukan perubahan skema tabel atau kolom baru pada saat booking/tip dibuat.
- **Kekurangan:**
  - Query rekursif atau window function menjadi berat jika pasien memiliki ribuan mutasi (meskipun pada praktik aplikasi telekonseling, mutasi per pasien umumnya < 50 baris).

#### Pendekatan 2: Model Jendela Kontaminasi Konservatif (Taint Overlap Window)
- **Mekanisme:**
  Pendekatan berbasis batas risiko keamanan (*risk containment*):
  1. Ketika sebuah `topup_orders` berstatus `refund` atau `chargeback`, periksa waktu penyelesaiannya (`settled_at`).
  2. Ambil seluruh booking dan tip yang dibuat oleh pasien tersebut pada atau setelah `settled_at` hingga status sengketa diselesaikan admin.
  3. Nominal rupiah dari `mitra_earnings` yang dihasilkan oleh booking/tip tersebut dimasukkan ke dalam daftar sengketa penahanan (*disputed hold pool*), hingga maksimal sebesar `amount_rupiah` (atau bagi hasil mitra dari koin order tersebut, yaitu `coins * 10000 * 80%`).
- **Kelebihan:**
  - Sangat cepat dieksekusi dengan query indeks sederhana (`WHERE patient_id = :p AND created_at >= :settled_at`).
  - Menjamin perlindungan 100% terhadap risiko defisit platform (*fail-safe*).
- **Kekurangan:**
  - Jika pasien memiliki banyak order top-up sah lainnya, pendekatan ini dapat menahan pendapatan mitra lebih besar daripada yang seharusnya (*over-holding*), sebelum diklarifikasi admin.

#### Pendekatan 3: Alokasi Lot Eksplisit (Explicit Lot Allocation / Deposit Envelope)
- **Mekanisme:**
  Sistem membuat tabel perantara `topup_coin_allocations`:
  ```sql
  CREATE TABLE public.topup_coin_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topup_order_id UUID NOT NULL REFERENCES public.topup_orders(id),
      patient_id UUID NOT NULL REFERENCES public.users(id),
      source_type TEXT NOT NULL, -- 'booking', 'extension', 'tip'
      source_id UUID NOT NULL,
      coins_spent BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
  Pada saat `booking_create` atau `tip_create` memotong koin, fungsi memotong saldo koin dari lot `topup_orders` tertua yang masih memiliki sisa koin (`remaining_coins > 0`).
- **Kelebihan:**
  - Determinisme 100% mutlak; setiap rupiah pendapatan mitra terikat langsung ke satu atau lebih `topup_order_id`.
  - Penahanan otomatis menjadi sangat mudah: cukup `JOIN` ke tabel alokasi untuk memeriksa apakah ada order induk yang berstatus `refund` atau `chargeback`.
- **Kekurangan:**
  - Memerlukan penulisan ulang dan migrasi pada fungsi-fungsi inti transaksi koin (`booking_create`, `session_lifecycle`, `tip_create`), sehingga berisiko tinggi (*high operational blast radius*) jika dilakukan terburu-buru.

---

## 4. Perbandingan Opsi Mekanisme Penahanan Payout Mitra (Q2 Opsi A)

Sesuai arahan Kapten Q2 Opsi A, bila dana koin yang digunakan untuk booking/tip disengketakan, payout mitra harus ditahan otomatis. Berikut analisis komparatif atas 4 opsi arsitektural:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     PERBANDINGAN OPSI MEKANISME PENAHANAN PAYOUT                         │
├─────────────┬──────────────────────────┬─────────────────────────┬───────────────────────┤
│ Opsi        │ Titik Intervensi         │ Mekanisme Teknis        │ Dampak Buku Besar     │
├─────────────┼──────────────────────────┼─────────────────────────┼───────────────────────┤
│ Opsi 1      │ Service Layer            │ Intersepsi saldo net    │ Nol (Zero DB mutation)│
│             │ (WalletPayoutService)    │ di API requestPayout    │ Tetap append-only     │
├─────────────┼──────────────────────────┼─────────────────────────┼───────────────────────┤
│ Opsi 2      │ Holding Engine           │ Cegah release_holding   │ Sedang (Hanya efektif │
│             │ (release_holding RPC)    │ ke available_rupiah     │ dalam 48 jam pertama) │
├─────────────┼──────────────────────────┼─────────────────────────┼───────────────────────┤
│ Opsi 3      │ Ledger Akun Baru         │ Debit mitra_available   │ Tinggi (Mutasi ledger │
│             │ (mitra_dispute_hold)     │ kredit dispute_hold     │ & risiko saldo minus) │
├─────────────┼──────────────────────────┼─────────────────────────┼───────────────────────┤
│ Opsi 4      │ Multi-Tier Hybrid        │ Tier 1: Holding Gate    │ Nol pada ledger inti  │
│ (Rekomendasi│ (Service + Flagging +    │ Tier 2: Net Withdrawable│ Fleksibel & aman bagi │
│  Arsitektur)│  Admin Verification Gate)│ Tier 3: Admin Review    │ operasional           │
└─────────────┴──────────────────────────┴─────────────────────────┴───────────────────────┘
```

---

### 4.1 Opsi 1: Intersepsi pada Service Layer & Payout Review Flag
- **Cara Kerja:**
  1. Pada saat mitra memanggil `POST /api/wallet/payout` (`WalletPayoutService.requestPayout`), sistem menghitung dua nilai:
     - `available_rupiah`: Saldo yang tercatat di tabel `wallets`.
     - `tainted_rupiah`: Total nominal pendapatan mitra dari `mitra_earnings` yang bersumber dari order berstatus `refund` atau `chargeback` yang belum diselesaikan admin.
  2. Dihitung saldo bersih yang dapat ditarik (*Withdrawable Available*):
     $$\text{Withdrawable} = \max(0, \text{available\_rupiah} - \text{tainted\_rupiah})$$
  3. **Penahanan:**
     - Jika nominal pengajuan `amount_rupiah > Withdrawable`:
       - *Sub-Opsi 1A (Hard Block):* Tolak pengajuan dengan HTTP 422 / HTTP 409:
         `{ success: false, error: 'PAYOUT_HELD_FOR_VERIFICATION', message: 'Sebagian saldo Anda sedang dalam proses peninjauan transaksi platform. Saldo yang dapat ditarik saat ini adalah Rp X.' }`.
       - *Sub-Opsi 1B (Soft Hold / Status Review):* Izinkan pembuatan `payout_requests`, namun tandai `status = 'held_for_review'` (atau flag `is_held = true`) sehingga admin mengetahui bahwa pencairan ini mengandung dana yang sedang disengketakan dan tidak dapat disetujui (*mark paid*) sebelum dispute diselesaikan.
- **Kelebihan:**
  - Tidak mengubah skema ledger atau formula database yang ada saat ini.
  - 100% aman terhadap aturan buku besar kekal (*append-only*).
  - Penahanan langsung aktif saat mitra berupaya menarik dana.
- **Kekurangan:**
  - Memerlukan komputasi pengecekan keterlacakan setiap kali endpoint payout dipanggil.

---

### 4.2 Opsi 2: Penahanan pada Lapisan Holding Release (`release_holding`)
- **Cara Kerja:**
  1. Fungsi `release_holding` yang dijalankan berkala memindai baris `mitra_earnings` yang sudah mencapai `available_at <= now()`.
  2. Tambahkan klausa pemeriksa pada kueri seleksi di `release_holding`:
     Jangan lepaskan (*skip*) baris `mitra_earnings` jika `source_id` terkait dengan `topup_orders` yang berstatus `refund` atau `chargeback`.
  3. Dana tetap mengendap di `pending_rupiah` mitra dan tidak pernah berpindah ke `available_rupiah`.
- **Kelebihan:**
  - Sederhana: dana tertahan secara alami di akun `mitra_pending`.
  - Mencegah dana sama sekali muncul sebagai "saldo tersedia" di dashboard mitra.
- **Kekurangan Fatal:**
  - **Keterbatasan Waktu:** *Chargeback* kartu kredit atau e-wallet sering kali dilaporkan oleh bank atau pemegang kartu 7 hingga 60 hari setelah transaksi. Padahal holding period TemanBicara hanya **48 jam**.
  - Jika chargeback tiba pada hari ke-10, dana mitra **sudah terlanjur rilis** ke `available_rupiah` 8 hari sebelumnya. Opsi 2 sama sekali tidak dapat melindungi platform dari chargeback yang terjadi setelah 48 jam.

---

### 4.3 Opsi 3: Mutasi Buku Besar Penahanan Kompensasi (`mitra_dispute_hold`)
- **Cara Kerja:**
  1. Buat akun baru pada enum/check constraint `ledger_entries.account`: `'mitra_dispute_hold'`.
  2. Saat webhook `chargeback` diterima, sistem membuat entri pembalik (*compensating entry*):
     - Debit `mitra_available`: $-X$ rupiah.
     - Kredit `mitra_dispute_hold`: $+X$ rupiah.
     - `wallets.available_rupiah` berkurang sebesar $X$.
  3. Jika dispute dimenangkan platform: balikkan kembali dari `mitra_dispute_hold` ke `mitra_available`.
  4. Jika dispute kalah (dana disita): lakukan *write-off* dari `mitra_dispute_hold` ke akun kerugian `platform_dispute_loss`.
- **Kelebihan:**
  - Konsisten secara akuntansi murni perbankan (*double-entry bookkeeping*).
- **Kekurangan & Risiko:**
  - **Risiko Saldo Negatif:** Jika mitra telah menarik seluruh dananya sebelum chargeback tiba (`available_rupiah = 0`), eksekusi debit akan melempar exception `INSUFFICIENT_BALANCE` pada `apply_wallet_ledger_internal` (karena ada `CHECK (available_rupiah >= 0)`). Jika diizinkan minus, ini melanggar skema database saat ini.
  - Membutuhkan migrasi DDL besar pada `wallets`, `ledger_entries`, dan fungsi `apply_wallet_ledger_internal`.

---

### 4.4 Opsi 4 (Rekomendasi Utama): Arsitektur Pertahanan Berlapis (Multi-Tier Hybrid Guardrail)

Mengingat kelebihan dan keterbatasan masing-masing opsi, arsitektur terbaik yang direkomendasikan adalah **Opsi 4 (Multi-Tier Hybrid Guardrail)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│               ARSITEKTUR MULTI-TIER HYBRID GUARDRAIL (OPSI 4)          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    [ Webhook Midtrans: refund / chargeback ] (T-210)
                                    │
                                    ▼
    ┌────────────────────────────────────────────────────────────────┐
    │ TIER 1: HOLDING GATE (Untuk Pendapatan < 48 Jam)               │
    │ Jika earning terkait masih di `mitra_earnings` belum rilis:    │
    │ Tandai earning sebagai disputed_hold (tidak dirilis ke         │
    │ available_rupiah oleh cron release_holding).                   │
    └────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌────────────────────────────────────────────────────────────────┐
    │ TIER 2: WITHDRAWAL INTERCEPTION (Untuk Pendapatan > 48 Jam)    │
    │ Saat mitra memanggil WalletPayoutService.requestPayout:        │
    │ Hitung Net Available = available_rupiah - disputed_amount.     │
    │ Jika amount > Net Available:                                   │
    │ Payout request dibuat dengan status 'held_for_review'          │
    │ ATAU ditolak dengan alasan peninjauan kepatuhan platform.      │
    └────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌────────────────────────────────────────────────────────────────┐
    │ TIER 3: ADMIN PAYOUT QUEUE & ACTION GATE                       │
    │ Di antrean admin (GET /api/admin/payouts):                     │
    │ - Beri badge peringatan merah: "TERKAIT ORDER SENGKETA".       │
    │ - Tombol "Setujui Pembayaran" (payout_mark_paid) dinonaktifkan │
    │   otomatis oleh sistem sebelum dispute diklarifikasi admin.    │
    └────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌────────────────────────────────────────────────────────────────┐
    │ TIER 4: WORKFLOW PENYELESAIAN SENGKETA ADMIN                   │
    │ Admin melakukan audit di dashboard khusus:                     │
    │ 1. Dispute Menang / Sah -> Clear hold -> Payout dapat diproses.│
    │ 2. Dispute Kalah / Fraud -> Admin melakukan penyesuaian resmi. │
    └────────────────────────────────────────────────────────────────┘
```

---

## 5. Evaluasi Dampak terhadap Append-Only Ledger

### 5.1 Kekekalan Buku Besar (Immutability Guarantee)
Prinsip utama yang wajib dipertahankan adalah:
- **Dilarang memodifikasi riwayat:** Trigger `reject_ledger_mutation` pada tabel `public.ledger_entries` tidak boleh dinonaktifkan atau dilemahkan.
- **Tanpa UPDATE Saldo Siluman:** Tidak boleh ada manipulasi langsung terhadap kolom `wallets.available_rupiah` atau `wallets.pending_rupiah` di luar fungsi ledger.
- **Pemisahan Antara Hak Hukum (*Entitlement*) dan Hak Penarikan (*Withdrawable Limit*):**
  Dalam hukum perbankan dan fintech, saat terjadi chargeback, dana yang telah menjadi hak mitra tidak serta merta dibatalkan secara sepihak sebelum investigasi sengketa selesai. Oleh karena itu:
  - Saldo buku besar mitra tetap mencatat kepemilikan dana secara sah (*entitled balance*).
  - Sistem penahanan bekerja pada lapisan **otorisasi pencairan (*disbursement authorization gate*)**, bukan dengan menghapus data kredit yang sah dari buku besar.

### 5.2 Konservasi Nilai Moneter
Jika admin pada akhirnya memutuskan bahwa chargeback merupakan fraud pasien murni:
- Koin pasien yang belum terpakai dapat disesuaikan secara manual oleh admin melalui entri kompensasi resmi di `ledger_entries`.
- Jika sesi telah terlaksana dengan baik oleh mitra, platform secara etis dan operasional dapat memilih untuk menanggung (*absorb*) biaya tersebut sebagai risiko operasional (*operational loss/chargeback expense*), sehingga mitra yang telah memberikan layanan secara jujur tetap menerima haknya setelah verifikasi admin selesai.

---

## 6. Spesifikasi Antarmuka & Skema Data Masa Depan

Sebagai tindak lanjut implementasi di fase berikutnya (T-212 / PRD rilis berikutnya), berikut spesifikasi teknis yang diusulkan:

### 6.1 Usulan Skema Tabel Penahanan (Non-Destructive Extension)
Untuk menghindari modifikasi tabel inti yang berisiko, penahanan dapat dikelola melalui tabel metadata sengketa:

```sql
-- Draf Skema (Fase Implementasi Berikutnya):
CREATE TABLE IF NOT EXISTS public.disputed_payout_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topup_order_id UUID NOT NULL REFERENCES public.topup_orders(id),
    mitra_id UUID NOT NULL REFERENCES public.users(id),
    source_type TEXT NOT NULL CHECK (source_type IN ('session', 'extension', 'tip')),
    source_id UUID NOT NULL,
    disputed_amount_rupiah BIGINT NOT NULL CHECK (disputed_amount_rupiah > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleared', 'deducted')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS disputed_payout_mitra_idx 
ON public.disputed_payout_holds(mitra_id, status);
```

### 6.2 Penyesuaian Antarmuka Layanan (`WalletPayoutService`)
Pada method `requestPayout`:
```typescript
// Perhitungan saldo yang aman ditarik
const { data: activeHolds } = await supabaseAdmin
  .from('disputed_payout_holds')
  .select('disputed_amount_rupiah')
  .eq('mitra_id', mitra.id)
  .eq('status', 'active');

const totalHeldRupiah = (activeHolds ?? []).reduce(
  (sum, row) => sum + Number(row.disputed_amount_rupiah),
  0
);

const withdrawableAvailable = Math.max(0, currentAvailable - totalHeldRupiah);

if (input.amount_rupiah + feeRupiah > withdrawableAvailable) {
  throw new WalletHttpError(
    422,
    'PAYOUT_INSUFFICIENT_UNENCUMBERED_BALANCE',
    `Sebagian saldo Anda (Rp ${totalHeldRupiah.toLocaleString('id-ID')}) sedang dalam status peninjauan verifikasi transaksi platform. Maksimal pencairan yang dapat diproses saat ini adalah Rp ${Math.max(0, withdrawableAvailable - feeRupiah).toLocaleString('id-ID')}.`
  );
}
```

### 6.3 Penyesuaian Antarmuka Admin Payout
Pada `GET /api/admin/payouts`:
- Respon `AdminPayoutItem` diperkaya dengan metadata:
  ```typescript
  export interface AdminPayoutItem {
    id: string;
    mitra_id: string;
    mitra_name: string;
    mitra_role?: UserRole;
    amount_rupiah: number;
    fee_rupiah: number;
    bank_name: string;
    account_number: string;
    bank_account_name: string;
    status: PayoutStatus;
    requested_at: string;
    decided_at?: string | null;
    decided_by?: string | null;
    // Kolom analisis proteksi risiko:
    has_dispute_hold?: boolean;
    dispute_hold_amount?: number;
    dispute_details?: {
      topup_order_id: string;
      reason: string;
    }[];
  }
  ```
- Pada `POST /api/admin/payouts/[id]/approve`:
  - Jika `has_dispute_hold === true`, sistem melempar validasi bahwa admin harus mencentang persetujuan eksplisit (*override bypass confirmation*) atau menyelesaikan sengketa topup terlebih dahulu.

---

## 7. Rencana Langkah Implementasi Bertahap (Roadmap)

Untuk menjamin kelancaran sistem tanpa regresi, implementasi dibagi ke dalam 3 tahap:

| Tahap | Fokus Pekerjaan | Risiko | Aksi Utama |
|---|---|---|---|
| **Tahap 1: Read-Only Detection (Advisory)** | Deteksi & Visibilitas Admin | Nol (Read-Only) | Membuat query/view untuk mendeteksi korelasi antara `topup_orders` dispute dan `mitra_earnings`. Menampilkan peringatan pada antrean Payout Admin tanpa memblokir sistem. |
| **Tahap 2: Guardrail Service Layer** | Penahanan di `WalletPayoutService` | Rendah | Mengaktifkan validasi `withdrawableAvailable` pada saat mitra mengajukan payout. Menandai pengajuan yang terdampak status review. |
| **Tahap 3: Dispute Resolution Dashboard** | Fitur Resolusi Kasus Admin | Rendah | Menyediakan antarmuka bagi admin untuk menyelesaikan sengketa Midtrans (menghapus status penahanan jika valid, atau mencatat kerugian jika fraud). |

---

## 8. Kesimpulan & Rekomendasi untuk Kapten

1. **Keputusan Q2 Opsi A Sangat Tepat:**
   Mekanisme penahanan payout mitra otomatis sangat krusial untuk mencegah kebocoran kas platform dari klaim sengketa perbankan Midtrans.
2. **Pertahankan Integritas Append-Only Ledger:**
   Penahanan dana sebaiknya dilakukan pada lapisan **kebijakan otorisasi pencairan (*withdrawable authorization*)** di `WalletPayoutService` dan penandaan antrean admin, bukan dengan memanipulasi atau menghapus entri historis pada buku besar database.
3. **Langkah Berikutnya:**
   - Evaluasi usulan arsitektur Opsi 4 oleh Kapten / Tech Lead.
   - Setelah disetujui, buat tiket implementasi Tahap 1 & 2 untuk backend dan koordinasikan penyesuaian UI antrean payout dengan Rimuru (Frontend Lead).
