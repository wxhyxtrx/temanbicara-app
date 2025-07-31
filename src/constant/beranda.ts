// Data konsultan terverifikasi
export const verifiedConsultants = [
  {
    id: 1,
    name: "Dr. Anita Wijaya",
    specialty: "Psikolog Klinis",
    rating: 4.9,
    reviews: 124,
    avatar: "/images/mascot1.png",
    available: true,
  },
  {
    id: 2,
    name: "Budi Santoso, M.Psi",
    specialty: "Konselor Karier",
    rating: 4.7,
    reviews: 98,
    avatar: "/images/mascot1.png",
    available: true,
  },
  {
    id: 3,
    name: "Siti Rahayu, S.Psi",
    specialty: "Konselor Remaja",
    rating: 4.8,
    reviews: 112,
    avatar: "/images/mascot1.png",
    available: false,
  },
];

// Data jadwal sesi
export const upcomingSessions = [
  {
    id: 1,
    consultant: "Dr. Anita Wijaya",
    date: "Senin, 15 Juli 2024",
    time: "14:00 - 15:00",
    status: "confirmed", // confirmed, pending, completed
  },
  {
    id: 2,
    consultant: "Budi Santoso, M.Psi",
    date: "Rabu, 17 Juli 2024",
    time: "10:00 - 11:00",
    status: "pending",
  },
];

// Data riwayat percakapan
export const recentConversations = [
  {
    id: 1,
    with: "TemanBicara AI",
    lastMessage: "Terima kasih sudah berbagi cerita hari ini. Bagaimana perasaanmu sekarang?",
    time: "Kemarin, 20:45",
    avatar: "/images/mascot1.png",
  },
  {
    id: 2,
    with: "Dr. Anita Wijaya",
    lastMessage: "Jangan lupa latihan pernapasan yang sudah kita bahas ya.",
    time: "3 hari lalu",
    avatar: "/images/mascot1.png",
  },
];

export const moodOptions = [
  { value: "happy", label: "😊 Senang", color: "bg-green-100 text-green-800" },
  { value: "neutral", label: "😐 Biasa", color: "bg-blue-100 text-blue-800" },
  { value: "sad", label: "😔 Sedih", color: "bg-yellow-100 text-yellow-800" },
  { value: "anxious", label: "😰 Cemas", color: "bg-orange-100 text-orange-800" },
  { value: "stressed", label: "😫 Stres", color: "bg-red-100 text-red-800" },
];