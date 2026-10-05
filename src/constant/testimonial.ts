export interface Testimonial {
  id: number;
  text: string;
  author: string;
  role: string;
  avatar?: string;
  rating: number;
  initials: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 1,
    text: "Kecemasan dan burnout pekerjaan yang selama ini saya pendam sendirian akhirnya terurai setelah beberapa sesi bersama psikolog di TemanBicara. Pendekatannya sangat menenangkan, logis, dan tanpa penghakiman sama sekali.",
    author: "Rian K.",
    role: "Software Engineer, 29 tahun",
    rating: 5,
    initials: "RK",
  },
  {
    id: 2,
    text: "Sebagai seorang overthinker berat, fitur Curhat AI 24/7 sangat membantu meredakan serangan panik tengah malam sebelum lanjut sesi terjadwal dengan Bu Anita. Sekarang saya punya teknik grounding sendiri.",
    author: "Sarah M.",
    role: "Mahasiswi Tingkat Akhir, 23 tahun",
    rating: 5,
    initials: "SM",
  },
  {
    id: 3,
    text: "Privasi anonimnya membuat saya berani terbuka. Sebagai laki-laki yang tadinya takut dianggap lemah, di sini saya merasa aman bercerita tentang duka dan tekanan keluarga yang saya hadapi.",
    author: "Anonim",
    role: "Karyawan Swasta, 34 tahun",
    rating: 5,
    initials: "AN",
  },
  {
    id: 4,
    text: "Konseling pernikahan dengan psikolog keluarga di TemanBicara membuka cara pandang baru bagi saya dan pasangan. Komunikasi kami jauh lebih sehat dan penuh empati.",
    author: "Dimas & Ratna",
    role: "Pasangan Menikah 4 Tahun",
    rating: 5,
    initials: "DR",
  },
  {
    id: 5,
    text: "Awalnya skeptis dengan sesi psikologi online, tapi sistem reservasi, fleksibilitas waktu, dan ruang percakapan privatnya luar biasa nyaman. Seperti berada di ruang konsultasi sungguhan.",
    author: "Nadia P.",
    role: "Creative Director, 28 tahun",
    rating: 5,
    initials: "NP",
  },
  {
    id: 6,
    text: "Belajar menerima diri sendiri dan melepaskan trauma masa lalu secara bertahap. Psikolognya membimbing dengan penuh kehangatan dan memberikan tugas refleksi yang realistis.",
    author: "Fajar W.",
    role: "Entrepreneur, 31 tahun",
    rating: 5,
    initials: "FW",
  },
];
