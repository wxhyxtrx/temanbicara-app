// Data konsultan terverifikasi (Psikolog Klinis & Konselor Berlisensi)
export interface Consultant {
  id: number;
  name: string;
  title: string;
  specialty: string;
  licenseNumber: string; // SIPPK
  experienceYears: number;
  rating: number;
  reviews: number;
  initials: string;
  available: boolean;
  nextSlot: string;
  almamater?: string;
  bio?: string;
  approaches?: string[];
  handledTopics?: string[];
  hourlyRateCoins?: number;
  consultationMethods?: ("Chat Eksklusif" | "Voice Call")[];
}

export const verifiedConsultants: Consultant[] = [
  {
    id: 1,
    name: "Dr. Anita Wijaya, M.Psi., Psikolog",
    title: "Psikolog Klinis Dewasa (SIPPK Aktif)",
    specialty: "Kecemasan, Burnout & Trauma Recovery",
    licenseNumber: "SIPPK-2021-0481",
    experienceYears: 9,
    rating: 4.9,
    reviews: 248,
    initials: "AW",
    available: true,
    nextSlot: "Hari ini, 15:00 WIB",
    almamater: "Magister Profesi Psikologi Klinis - Universitas Indonesia (UI)",
    bio: "Psikolog klinis terdaftar HIMPSI dengan dedikasi 9+ tahun membantu dewasa muda dan profesional memproses kecemasan berlebih, kejenuhan karier (burnout), serta luka emosional masa lalu melalui ruang aman tanpa penghakiman.",
    approaches: [
      "Cognitive Behavioral Therapy (CBT)",
      "Mindfulness-Based Stress Reduction (MBSR)",
      "Acceptance & Commitment Therapy (ACT)",
    ],
    handledTopics: [
      "Panic Attack & Kecemasan",
      "Workplace Burnout",
      "Overthinking & Insomnia",
      "Trauma & Regulasi Emosi",
    ],
    hourlyRateCoins: 15,
    consultationMethods: ["Chat Eksklusif", "Voice Call"],
  },
  {
    id: 2,
    name: "Budi Santoso, M.Psi., Psikolog",
    title: "Psikolog Klinis & Pengembangan Diri",
    specialty: "Manajemen Stres & Krisis Identitas",
    licenseNumber: "SIPPK-2019-1102",
    experienceYears: 7,
    rating: 4.8,
    reviews: 182,
    initials: "BS",
    available: true,
    nextSlot: "Besok, 10:00 WIB",
    almamater: "Magister Profesi Psikologi - Universitas Gadjah Mada (UGM)",
    bio: "Fokus mendampingi individu yang mengalami krisis arah hidup (quarter-life crisis), tekanan karier, dan konflik identitas. Mengutamakan solusi praktis dan restrukturisasi pola pikir adaptif.",
    approaches: [
      "Solution-Focused Brief Therapy (SFBT)",
      "Cognitive Behavioral Therapy (CBT)",
      "Rational Emotive Behavior Therapy (REBT)",
    ],
    handledTopics: [
      "Quarter-Life Crisis",
      "Ekspektasi Karier & Burnout",
      "Manajemen Konflik & Komunikasi",
      "Rasa Percaya Diri (Self-Esteem)",
    ],
    hourlyRateCoins: 15,
    consultationMethods: ["Chat Eksklusif", "Voice Call"],
  },
  {
    id: 3,
    name: "Siti Rahayu, S.Psi., M.A., Psikolog",
    title: "Konselor Hubungan Interpersonal & Keluarga",
    specialty: "Komunikasi Pasangan & Dinamika Emosi",
    licenseNumber: "SIPPK-2022-0934",
    experienceYears: 6,
    rating: 4.9,
    reviews: 145,
    initials: "SR",
    available: false,
    nextSlot: "Kamis, 14:00 WIB",
    almamater: "Magister Psikologi Perkembangan - Universitas Padjadjaran (UNPAD)",
    bio: "Berpengalaman memfasilitasi rekonsiliasi emosi dalam relasi romantis, mengatasi attachment anxiety, serta menavigasi batasan sehat (boundaries) dengan keluarga dan lingkungan sosial.",
    approaches: [
      "Emotion-Focused Therapy (EFT)",
      "Systemic Family Counseling",
      "Nonviolent Communication (NVC)",
    ],
    handledTopics: [
      "Dinamika Asmara & Pasangan",
      "Healthy Boundaries & Keluarga",
      "Kesepian & Hubungan Sosial",
      "Duka & Pemulihan Kehilangan",
    ],
    hourlyRateCoins: 15,
    consultationMethods: ["Chat Eksklusif"],
  },
];

// Data jadwal sesi konsultasi
export interface UpcomingSession {
  id: number;
  consultant: string;
  title: string;
  date: string;
  time: string;
  type: "Chat Eksklusif" | "Voice Call";
  status: "confirmed" | "pending" | "completed";
  roomReady: boolean;
}

export const upcomingSessions: UpcomingSession[] = [
  {
    id: 1,
    consultant: "Dr. Anita Wijaya, M.Psi.",
    title: "Sesi Terapi Regulasi Emosi & CBT",
    date: "Rabu, 07 Oktober 2026",
    time: "14:00 - 15:00 WIB",
    type: "Voice Call",
    status: "confirmed",
    roomReady: true,
  },
  {
    id: 2,
    consultant: "Budi Santoso, M.Psi.",
    title: "Follow-up Rencana Evaluasi Karier",
    date: "Jumat, 09 Oktober 2026",
    time: "10:00 - 11:00 WIB",
    type: "Chat Eksklusif",
    status: "pending",
    roomReady: false,
  },
];

// Data riwayat percakapan
export interface RecentConversationItem {
  id: number;
  with: string;
  role: string;
  lastMessage: string;
  time: string;
  unread: number;
  isAI: boolean;
  initials: string;
}

export const recentConversations: RecentConversationItem[] = [
  {
    id: 1,
    with: "TemanBicara AI Empatik",
    role: "Pendamping Emosi 24/7",
    lastMessage: "Terima kasih sudah mempraktikkan teknik grounding 5-4-3-2-1. Apakah detak jantungmu sudah terasa lebih stabil?",
    time: "Hari ini, 06:30",
    unread: 0,
    isAI: true,
    initials: "TB",
  },
  {
    id: 2,
    with: "Dr. Anita Wijaya, M.Psi.",
    role: "Psikolog Klinis",
    lastMessage: "Lembar jurnal CBT sudah saya lampirkan di ruang berkas. Coba isi secara perlahan saat waktu senggang ya.",
    time: "Kemarin, 16:40",
    unread: 1,
    isAI: false,
    initials: "AW",
  },
];

// Opsi Mood / Emotion Tracker Terapeutik
export interface MoodOption {
  value: string;
  label: string;
  tone: string;
  quote: string;
  recommendation: string;
  colorClass: string;
  activeColorClass: string;
}

export const moodOptions: MoodOption[] = [
  {
    value: "calm",
    label: "Tenang & Stabil",
    tone: "Pikiran terasa jernih dan ritme napas teratur.",
    quote: "Ketenangan adalah fondasi ketahanan emosi. Syukuri jeda ini dan biarkan energimu terisi kembali.",
    recommendation: "Pertahankan ketenangan dengan jurnal rasa syukur atau jalan santai tanpa layar 15 menit.",
    colorClass: "border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/60 dark:hover:bg-teal-950/70",
    activeColorClass: "border-teal-600 bg-teal-600 text-white shadow-xs",
  },
  {
    value: "anxious",
    label: "Gelisah / Cemas",
    tone: "Pikiran berputar cepat dan dada terasa sesak.",
    quote: "Kecemasan adalah respon protektif tubuh yang sedang waspada. Kamu aman saat ini, dan perasaan ini akan surut.",
    recommendation: "Lakukan latihan napas 4-7-8 atau curahkan kekhawatiranmu ke AI Pendengar untuk memetakan pikiran.",
    colorClass: "border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/60 dark:hover:bg-amber-950/70",
    activeColorClass: "border-amber-600 bg-amber-600 text-white shadow-xs",
  },
  {
    value: "exhausted",
    label: "Lelah / Burnout",
    tone: "Energi emosi terkuras dan sulit fokus.",
    quote: "Istirahat bukanlah tanda kegagalan, melainkan kebutuhan biologis yang sah. Lepaskan tuntutan kesempurnaan.",
    recommendation: "Tetapkan batasan tegas hari ini, kurangi beban komitmen, dan jadwalkan sesi evaluasi beban mental.",
    colorClass: "border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 bg-sky-50/60 dark:bg-sky-950/40 hover:bg-sky-100/60 dark:hover:bg-sky-950/70",
    activeColorClass: "border-sky-600 bg-sky-600 text-white shadow-xs",
  },
  {
    value: "sad",
    label: "Sedih / Berduka",
    tone: "Hati terasa berat dan membutuhkan pelukan empati.",
    quote: "Air mata dan rasa hampa adalah proses penyembuhan alami. Beri dirimu izin untuk berduka tanpa rasa malu.",
    recommendation: "Jangan menanggungnya sendirian. Ceritakan apa yang mengganjal pada konselor atau teman tepercaya.",
    colorClass: "border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/70",
    activeColorClass: "border-indigo-600 bg-indigo-600 text-white shadow-xs",
  },
  {
    value: "overwhelmed",
    label: "Kewalahan (Overwhelmed)",
    tone: "Banyak hal menumpuk dan tidak tahu harus mulai dari mana.",
    quote: "Kamu tidak perlu menyelesaikan seluruh hidupmu hari ini. Cukup selesaikan satu tarikan napas berikutnya.",
    recommendation: "Uraikan satu masalah terkecil saja. Gunakan AI Sanctuary untuk memilah prioritas tindakan.",
    colorClass: "border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100/60 dark:hover:bg-rose-950/70",
    activeColorClass: "border-rose-600 bg-rose-600 text-white shadow-xs",
  },
];
