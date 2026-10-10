import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";
import { useChatStore } from "@/store/chat-store";
import { useCrisisStore } from "@/store/crisis-store";

export interface VentingPost {
  id: string;
  patientAlias: string;
  topic: string;
  emotion: string;
  emotionColor: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  timestamp: number;
  status: "menunggu" | "ditangani" | "selesai";
  handledByListenerId?: string;
  handledByListenerName?: string;
  firstResponse?: string;
  conversationId?: number;
  rating?: number;
  reviewTags?: string[];
  tipCoins?: number;
  isCrisisFlagged?: boolean;
}

const initialPosts: VentingPost[] = [
  {
    id: "vent-1",
    patientAlias: "Bunga Biru",
    topic: "Kesepian & Hubungan",
    emotion: "Merasa Kesepian",
    emotionColor: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200",
    content: "Sedang ngerasa sepi banget malam ini, rasanya seperti berjuang sendirian di kota besar. Butuh teman cerita yang mau mendengarkan tanpa menghakimi...",
    isAnonymous: true,
    createdAt: "3 menit lalu",
    timestamp: Date.now() - 3 * 60 * 1000,
    status: "menunggu",
  },
  {
    id: "vent-2",
    patientAlias: "Langit Senja",
    topic: "Akademik & Ekspektasi",
    emotion: "Kelelahan Mental",
    emotionColor: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200",
    content: "Beban tugas akhir dan ekspektasi keluarga bikin dada sesak. Takut mengecewakan orang tua tapi fisik dan pikiran sudah di titik lelah...",
    isAnonymous: true,
    createdAt: "8 menit lalu",
    timestamp: Date.now() - 8 * 60 * 1000,
    status: "menunggu",
  },
  {
    id: "vent-3",
    patientAlias: "Rintik Hujan",
    topic: "Karier & Overthinking",
    emotion: "Kecemasan Ringan",
    emotionColor: "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200",
    content: "Gak tahu harus mulai dari mana, tapi rasanya overthinking terus soal masa depan dan ketidakpastian pekerjaan...",
    isAnonymous: true,
    createdAt: "15 menit lalu",
    timestamp: Date.now() - 15 * 60 * 1000,
    status: "menunggu",
  },
];

export interface PeerVentState {
  posts: VentingPost[];
  myActivePost: VentingPost | null;
  dailySessionsCompleted: number;
  maxDailySessions: number;
  isOnBreak: boolean;
  toggleBreakMode: (forceState?: boolean) => void;
  resetDailyQuota: () => void;
  createPost: (data: {
    topic: string;
    emotion: string;
    content: string;
    isAnonymous: boolean;
    alias?: string;
  }) => VentingPost;
  claimPost: (
    postId: string,
    listenerId: string,
    listenerName: string,
    firstResponse: string
  ) => { success: boolean; message: string };
  closeSession: (
    postId: string,
    rating?: number,
    reviewTags?: string[],
    tipCoins?: number
  ) => void;
  reportCrisisIncident: (
    postId: string,
    reason: string
  ) => { success: boolean; message: string };
  getListenerActiveCount: (listenerId: string) => number;
}

export const usePeerVentStore = create<PeerVentState>()(
  persist(
    (set, get) => ({
      posts: initialPosts,
      myActivePost: null,
      dailySessionsCompleted: 2,
      maxDailySessions: 4,
      isOnBreak: false,

      toggleBreakMode: (forceState) => {
        const nextState = forceState !== undefined ? forceState : !get().isOnBreak;
        set({ isOnBreak: nextState });
        useNotificationStore.getState().addNotification({
          title: nextState ? "Mode Istirahat Aktif" : "Kembali Siap Mendengarkan",
          message: nextState
            ? "Anda sedang beristirahat. Antrean curhatan baru dijeda untuk pemulihan energi emosi Anda."
            : "Status Anda kini aktif. Anda siap mendampingi teman curhat sebaya kembali.",
          type: "sistem",
        });
      },

      resetDailyQuota: () => {
        set({ dailySessionsCompleted: 0 });
      },

      getListenerActiveCount: (listenerId: string) => {
        return get().posts.filter(
          (p) => p.handledByListenerId === listenerId && p.status === "ditangani"
        ).length;
      },

      createPost: (data) => {
        const id = `vent-${Date.now()}`;
        const newPost: VentingPost = {
          id,
          patientAlias: data.alias || (data.isAnonymous ? "Sahabat Anonim" : "Wahyu"),
          topic: data.topic,
          emotion: data.emotion,
          emotionColor:
            data.emotion === "Kewalahan"
              ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200"
              : data.emotion === "Cemas"
              ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200"
              : data.emotion === "Sedih"
              ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200"
              : "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200",
          content: data.content,
          isAnonymous: data.isAnonymous,
          createdAt: "Baru saja",
          timestamp: Date.now(),
          status: "menunggu",
        };

        const updated = [newPost, ...get().posts];
        set({
          posts: updated,
          myActivePost: newPost,
        });

        // Trigger in-app notification
        useNotificationStore.getState().addNotification({
          title: "Keluh Kesah Terkirim ke Antrean Sebaya",
          message:
            "Curhatanmu sedang menunggu relawan Pendengar Sebaya terlatih. Kamu akan diberi tahu begitu ada respons.",
          type: "sistem",
        });

        return newPost;
      },

      claimPost: (postId, listenerId, listenerName, firstResponse) => {
        if (get().isOnBreak) {
          return {
            success: false,
            message:
              "Mode Istirahat sedang aktif. Matikan mode rehat untuk mulai menerima curhatan kembali.",
          };
        }

        if (get().dailySessionsCompleted >= get().maxDailySessions) {
          return {
            success: false,
            message:
              "Batas aman 4 sesi harian telah tercapai. Istirahatkan pikiran Anda demi menjaga kesehatan mental pribadi (Burnout Guard).",
          };
        }

        const activeCount = get().getListenerActiveCount(listenerId);
        if (activeCount >= 2) {
          return {
            success: false,
            message:
              "Batas maksimal 2 sesi aktif tercapai. Selesaikan salah satu sesi curhat yang sedang berlangsung terlebih dahulu untuk menjaga kualitas pendampingan.",
          };
        }

        const targetPost = get().posts.find((p) => p.id === postId);
        if (!targetPost) {
          return { success: false, message: "Curhatan tidak ditemukan." };
        }

        const updatedPosts = get().posts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              status: "ditangani" as const,
              handledByListenerId: listenerId,
              handledByListenerName: listenerName,
              firstResponse: firstResponse.trim(),
              conversationId: 4, // ID chat Dewi (Pendengar Sebaya)
            };
          }
          return p;
        });

        const updatedPost = updatedPosts.find((p) => p.id === postId);

        // Integrasi langsung ke chat-store:
        // Set pesan pembuka di conversation 4 (Dewi)
        const chatStore = useChatStore.getState();
        const nowTime = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        const initialMessages = [
          {
            id: Date.now() - 1000,
            conversationId: 4,
            sender: targetPost.patientAlias,
            senderRole: "patient" as const,
            initials: targetPost.patientAlias.slice(0, 2).toUpperCase(),
            content: `[Curhat Masuk - Topik: ${targetPost.topic} | Emosi: ${targetPost.emotion}]\n\n"${targetPost.content}"`,
            time: nowTime,
            isUser: true,
          },
          {
            id: Date.now(),
            conversationId: 4,
            sender: `${listenerName} (Pendengar Sebaya)`,
            senderRole: "peer_listener" as const,
            initials: "DW",
            content: firstResponse.trim(),
            time: nowTime,
            isUser: false,
          },
        ];

        chatStore.messagesByConversation[4] = initialMessages;
        chatStore.messages = initialMessages;
        chatStore.conversations = chatStore.conversations.map((c) =>
          c.id === 4
            ? {
                ...c,
                lastMessage: firstResponse.trim(),
                time: "Baru saja",
                statusText: `Mendampingi ${targetPost.patientAlias} (${targetPost.topic})`,
              }
            : c
        );

        set({
          posts: updatedPosts,
          myActivePost:
            get().myActivePost?.id === postId ? updatedPost || null : get().myActivePost,
        });

        // Notifikasi ke pasien bahwa curhatannya telah direspon
        useNotificationStore.getState().addNotification({
          title: `Curhatanmu Telah Ditanggapi oleh ${listenerName}!`,
          message: `"${firstResponse.trim().slice(0, 75)}..." Buka ruang percakapan untuk melanjutkan curhat.`,
          type: "sistem",
        });

        return {
          success: true,
          message: `Berhasil mendampingi ${targetPost.patientAlias}. Ruang chat dua arah telah aktif.`,
        };
      },

      closeSession: (postId, rating, reviewTags, tipCoins) => {
        const updatedPosts = get().posts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              status: "selesai" as const,
              rating: rating || 5,
              reviewTags: reviewTags || [],
              tipCoins: tipCoins || 0,
            };
          }
          return p;
        });

        set({
          posts: updatedPosts,
          dailySessionsCompleted: get().dailySessionsCompleted + 1,
          myActivePost:
            get().myActivePost?.id === postId ? null : get().myActivePost,
        });

        // Notifikasi penutupan sesi
        useNotificationStore.getState().addNotification({
          title: "Sesi Curhat Selesai",
          message:
            "Terima kasih telah berbagi beban emosi. Satu slot relawan pendengar telah kembali dibuka.",
          type: "sistem",
        });
      },

      reportCrisisIncident: (postId, reason) => {
        const targetPost = get().posts.find((p) => p.id === postId);
        if (!targetPost) return { success: false, message: "Curhatan tidak ditemukan." };

        // Tandai post
        set({
          posts: get().posts.map((p) =>
            p.id === postId ? { ...p, isCrisisFlagged: true } : p
          ),
        });

        // Teruskan ke crisis store
        useCrisisStore.getState().addReport({
          patientId: `PT-${targetPost.patientAlias.replace(/\s+/g, "").toUpperCase()}`,
          patientName: targetPost.patientAlias,
          patientAlias: targetPost.patientAlias,
          patientEmail: "pasien.anonim@temanbicara.id",
          patientPhone: "+62 812-9900-1122",
          emergencyContactName: "Kontak Darurat Terdaftar Pasien",
          emergencyContactPhone: "0811-9876-5432",
          source: "curhat_sebaya",
          severity: "critical",
          triggerExcerpt: `Dilaporkan oleh Relawan Pendengar: "${reason}" | Isi curhat: "${targetPost.content}"`,
        });

        return {
          success: true,
          message: "Laporan krisis darurat berhasil dikirimkan ke Tim Admin & Hotline SEJIWA 119.",
        };
      },
    }),
    {
      name: "tb_peer_vent_store_v1",
      version: 1,
    }
  )
);
