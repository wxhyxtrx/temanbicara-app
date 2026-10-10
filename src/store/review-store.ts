import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";

export interface SessionReview {
  id: string;
  scheduleId: string;
  consultantId: number;
  consultantName: string;
  patientId: string;
  patientName: string;
  isAnonymous: boolean;
  rating: number; // 1 to 5
  aspectTags: string[];
  comment: string;
  createdAt: string;
}

const initialReviews: SessionReview[] = [
  {
    id: "rev-01",
    scheduleId: "sch-03",
    consultantId: 2,
    consultantName: "Budi Santoso, M.Psi., Psikolog",
    patientId: "usr-demo-01",
    patientName: "Wahyu Tricahyo",
    isAnonymous: true,
    rating: 5,
    aspectTags: ["Hangat & Empatis", "Solutif & Terarah", "Ruang Aman"],
    comment: "Sesi konseling sangat berbobot dan menenangkan. Pendekatan pembagian batasan jam kerja dan restrukturisasi waktu benar-benar membantu saya mengurai burnout yang sudah 2 bulan menumpuk.",
    createdAt: "28 Sep 2026",
  },
  {
    id: "rev-02",
    scheduleId: "sch-04",
    consultantId: 1,
    consultantName: "Dr. Anita Wijaya, M.Psi.",
    patientId: "usr-demo-02",
    patientName: "Nadia Putri",
    isAnonymous: false,
    rating: 5,
    aspectTags: ["Sangat Mendengarkan", "Membantu Regulasi Emosi", "Bebas Penghakiman"],
    comment: "Dr. Anita sangat cermat mendengarkan tanpa memotong pembicaraan. Latihan napas diafragma dan penelusuran akar somatic anxiety langsung terasa dampaknya di tubuh saya.",
    createdAt: "23 Sep 2026",
  },
  {
    id: "rev-03",
    scheduleId: "sch-seed-01",
    consultantId: 1,
    consultantName: "Dr. Anita Wijaya, M.Psi.",
    patientId: "usr-demo-03",
    patientName: "Ahmad Rizky",
    isAnonymous: true,
    rating: 5,
    aspectTags: ["Solutif & Terarah", "Tepat Waktu", "Memberi Ketenangan"],
    comment: "Penjelasan CBT mengenai automatic negative thoughts sangat aplikatif. Setelah 3 sesi, frekuensi serangan cemas pagi hari saya menurun drastis.",
    createdAt: "15 Sep 2026",
  },
];

export interface ReviewState {
  reviews: SessionReview[];
  addReview: (payload: Omit<SessionReview, "id" | "createdAt">) => SessionReview;
  getReviewsByConsultant: (consultantId: number) => SessionReview[];
  hasReviewed: (scheduleId: string) => boolean;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      reviews: initialReviews,

      addReview: (payload) => {
        const id = `rev-${Date.now()}`;
        const createdAt = new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        const newReview: SessionReview = {
          ...payload,
          id,
          createdAt,
        };

        set({
          reviews: [newReview, ...get().reviews],
        });

        // Kirim notifikasi ke psikolog terkait
        useNotificationStore.getState().addNotification({
          title: `Ulasan Baru: Bintang ${payload.rating} ⭐`,
          message: `${payload.isAnonymous ? "Klien Anonim" : payload.patientName} memberikan ulasan: "${payload.comment.slice(0, 75)}${payload.comment.length > 75 ? "..." : ""}"`,
          type: "chat",
          actionUrl: "/counselor/beranda",
        });

        return newReview;
      },

      getReviewsByConsultant: (consultantId: number) => {
        return get().reviews.filter((r) => r.consultantId === consultantId);
      },

      hasReviewed: (scheduleId: string) => {
        return get().reviews.some((r) => r.scheduleId === scheduleId);
      },
    }),
    {
      name: "temanbicara_session_reviews",
    }
  )
);
