# Temuan UAT Fase 3 — dari Bang Wahyu (2026-10-18)

Status: DICATAT, belum dikerjakan. Menunggu Bang Wahyu selesai cek role lain (psikolog, relawan) sebelum dibuat task.

## Admin
1. **Moderasi Ulasan**
   - Nama menu terlalu panjang → cukup "Ulasan".
   - Kartu ringkasan di atas tidak konsisten: "Total Ulasan" = 1 saat filter Semua, jadi 0 saat filter Dilaporkan/Disembunyikan. Kartu harus selalu angka global (total, dilaporkan, disembunyikan), tidak ikut filter. (screenshot 1→2)

## Pasien
2. **Sidebar – Logout**: klik logout tidak langsung keluar; masih seperti punya token/sesi.
3. **Beranda – Modal Lihat Profil psikolog**: tampilan melebar/terpotong (overflow horizontal). (screenshot 3)
4. **Beranda – Modal Lihat Profil**: section "Metode & Pendekatan" — dummy atau data psikolog? Audit SEMUA section di modal: yang dummy dihapus; yang penting dibuat kolom DB + bisa diisi psikolog di pengaturannya.
5. **Beranda – Modal Pilih Jadwal**: melebar juga; apakah komponen sama dengan Lihat Profil?
6. **Beranda – fitur curhat (relawan)**: buat 3 curhatan tapi beranda hanya tampil 1. Apakah aturan 1 curhat aktif, atau hanya 1 yang ditampilkan? Ke mana yang lain? (screenshot 7) — catatan: fitur curhat sebaya = Fase 5 (belum dibangun backend-nya), cek apakah masih mock.
7. **Jadwal Bicara – "Pesan sesi sekarang" / "Jadwalkan Konsultasi Baru"**:
   - Muncul modal versi lama (screenshot 4: "Pilih Psikolog", slot 09/10/11 berulang, "Biaya 60 menit", "Setara Rp 0", saldo 755 koin — kemungkinan mock/legacy) lalu beberapa detik berubah jadi modal lain (screenshot 5).
   - Belum pilih psikolog tapi langsung muncul Dr. Wijaya.
   - Modal melebar/terpotong → tombol "Lanjutkan Booking" tidak bisa diklik. (screenshot 6)
8. **Pengaturan Akun – kontak darurat**: banner "lengkapi kontak darurat" harus juga ada di Beranda (wajib diisi), dengan informasi yang jelas.
9. **Pengaturan Akun – loading**: tidak ada skeleton/indikator; awalnya kosong lalu tiba-tiba terisi.
10. **Pengaturan Akun – integrasi**: pastikan semua tab (Profil, Kerahasiaan Medis, Notifikasi Sesi, Keamanan Akun) tersambung DB/API, bukan mock.
11. **Pengaturan Akun – simpan profil lalu logout**: setelah simpan, user tiba-tiba ter-logout. Jika memang disengaja, beri modal/banner info dulu; cek juga role lain.

## Catatan Claude (untuk triage nanti)
- No. 7 screenshot 4 kemungkinan modal booking lama (mock) yang masih dipakai di halaman Jadwal; F2 memakai booking-modal baru.
- Banner beranda pasien masih menulis "Fitur booking hadir di Fase 3" → harus diperbarui.
- Pembagian: perbaikan FE → Rimuru; kolom DB/API baru (mis. metode & pendekatan, logout server) → Paul.

## Relawan (bagian 2)
12. Force logout: request notifikasi kena 401 INVALID_TOKEN → otomatis keluar ke login "Sesi Anda Telah Berakhir". Beberapa endpoint relawan juga 401.
    - Fitur relawan (Ruang Dengar, antrean curhat) memang belum dibangun → Fase 5 (tampil "Segera Hadir").

## Psikolog (bagian 2)
13. Beranda: ulasan Fauzi sudah DISEMBUNYIKAN admin tapi masih tampil di beranda psikolog; lalu psikolog melaporkan → apakah dobel? Konsep "dilaporkan" vs "disembunyikan" belum jelas bagi user.
14. Jadwal: klik "Jeda terima booking" (PATCH /api/users/me {booking_paused:true}) → 401 INVALID_TOKEN → force logout.
15. Pengaturan akun: tidak ada loading; auto logout setelah edit + submit (sama dengan pasien no. 11).
16. Ruang Konseling (menu): kosong tanpa riwayat chat. Dari Catatan Klien → "Buka Ruang Sesi" mengarah ke sana. Konsep halaman perlu diperjelas.
17. Sidebar psikolog masih menandai "Ruang Konseling" & "Jadwal Konseling" sebagai "Segera" padahal sudah ada.

## AKAR MASALAH FORCE LOGOUT (dikoreksi — asumsi token 1 jam SALAH, user logout dalam ±4 menit)
- Log Auth Supabase: "token is malformed: invalid number of segments" → token yang dikirim bukan JWT.
- src/store/user-store.ts setAuthSession(): document.cookie = tb_access_token=${token || "session-token"} → dipanggil dengan token undefined di patient/settings, counselor/settings, listener/settings, listener/beranda, schedule-status-banner → cookie tertimpa "session-token" → 401 → handleUnauthorized logout.
- Penyebab no. 2(?), 11, 12, 14, 15. Hotfix dikirim ke Rimuru (fix/auth-token-overwrite).
- (Catatan terpisah, lebih kecil: tetap belum ada refresh token; sesi tetap akan habis setelah ±1 jam → tugas Paul nanti.)

## KEPUTUSAN USER (2026-10-18)
- Ulasan disembunyikan admin: tetap terlihat oleh psikolognya dengan label "Disembunyikan admin".
- Menu Ruang Konseling: pisahkan tab Sesi Aktif dan Riwayat.
- Section "Metode & Pendekatan" di profil psikolog: hapus saja.
