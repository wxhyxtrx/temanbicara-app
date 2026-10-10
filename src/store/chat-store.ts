import { create } from "zustand";
import { persist } from "zustand/middleware";

// Tipe untuk data percakapan
export interface Conversation {
  id: number;
  name: string;
  role: string;
  specialty?: string;
  avatar?: string;
  initials: string;
  lastMessage: string;
  time: string;
  unread: number;
  isAI: boolean;
  isPeerListener?: boolean;
  statusText: string;
  online: boolean;
  clientDiagnosis?: string;
  dassScore?: string;
  primaryNotes?: string;
}

// Tipe untuk lampiran rekam medis / gambar
export interface Attachment {
  name: string;
  url: string;
  type: "image" | "document";
  size?: string;
}

// Tipe untuk pesan
export interface Message {
  id: number;
  conversationId?: number;
  sender: string;
  senderRole?: "patient" | "counselor" | "peer_listener" | "ai";
  avatar?: string;
  initials?: string;
  content: string;
  time: string;
  isUser: boolean;
  audioUrl?: string;
  audioDuration?: string;
  attachment?: Attachment;
}

export interface ClinicalNoteRecord {
  s: string; // Subjective
  o: string; // Objective
  a: string; // Assessment
  p: string; // Plan
  updatedAt: string;
}

// Data percakapan psikologis, klinis & pendengar sebaya
const initialConversations: Conversation[] = [
  {
    id: 1,
    name: "TemanBicara AI",
    role: "Pendamping Emosi 24/7",
    specialty: "Psychological First Aid & Grounding",
    initials: "TB",
    lastMessage: "Halo, aku ada di sini untuk mendengarkan. Apa yang sedang memenuhi pikiranmu saat ini?",
    time: "Baru saja",
    unread: 0,
    isAI: true,
    statusText: "Siaga 24 Jam • Respon Instan",
    online: true,
  },
  {
    id: 2,
    name: "Dr. Anita Wijaya, M.Psi.",
    role: "Psikolog Klinis Dewasa",
    specialty: "Kecemasan, Burnout & Trauma",
    initials: "AW",
    lastMessage: "Jangan lupa latihan pernapasan diafragma yang sudah kita diskusikan sebelum sesi berikutnya ya.",
    time: "3 jam lalu",
    unread: 1,
    isAI: false,
    statusText: "Praktik Aktif • Sesi Terverifikasi",
    online: true,
    clientDiagnosis: "F41.1 Ansietas Menyeluruh & Work-related Burnout",
    dassScore: "Depresi: 6 (Normal) | Ansietas: 16 (Tinggi) | Stres: 18 (Sedang)",
    primaryNotes: "Klien melaporkan sesak napas dan insomnia jelang review kuartal kerja.",
  },
  {
    id: 3,
    name: "Budi Santoso, M.Psi., Psikolog",
    role: "Psikolog Karier & Emosi",
    specialty: "Manajemen Stres Kerja",
    initials: "BS",
    lastMessage: "Bagaimana perkembangan jurnal pemetaan pemicu stres yang kamu buat kemarin?",
    time: "Kemarin",
    unread: 0,
    isAI: false,
    statusText: "Jadwal Praktik Berikutnya: Besok",
    online: false,
    clientDiagnosis: "Burnout Akademik & Karier",
    dassScore: "Stres: 14 (Sedang)",
  },
  {
    id: 4,
    name: "Dewi (Pendengar Sebaya)",
    role: "Relawan Empati Terlatih PFA",
    specialty: "Curhat Anonim & Active Listening",
    initials: "DW",
    lastMessage: "Halo! Aku siap mendengarkan ceritamu tanpa menghakimi malam ini.",
    time: "10 mnt lalu",
    unread: 0,
    isAI: false,
    isPeerListener: true,
    statusText: "Ruang Curhat Sebaya • 100% Anonim",
    online: true,
  },
];

// Data pesan default per-percakapan
const initialMessagesByConv: Record<number, Message[]> = {
  1: [
    {
      id: 101,
      conversationId: 1,
      sender: "TemanBicara AI Empatik",
      initials: "TB",
      content: "Halo! Selamat datang di ruang tenangmu. Apa pun yang kamu rasakan hari ini valid dan aman untuk diungkapkan. Apa yang ingin kamu bagikan?",
      time: "10:00",
      isUser: false,
    },
    {
      id: 102,
      conversationId: 1,
      sender: "Kamu",
      content: "Halo. Aku merasa sangat cemas dan kepikiran pekerjaan terus-menerus beberapa hari ini. Rasanya dada sesak dan sulit tidur.",
      time: "10:02",
      isUser: true,
    },
    {
      id: 103,
      conversationId: 1,
      sender: "TemanBicara AI Empatik",
      initials: "TB",
      content: "Terima kasih sudah berani mengungkapkan ini. Mengalami kecemasan hingga memengaruhi fisik seperti dada sesak tentu melelahkan. Apakah kamu bersedia mengambil 1 menit jeda bersama untuk latihan napas perlahan, atau kamu ingin terus bercerita?",
      time: "10:03",
      isUser: false,
    },
  ],
  2: [
    {
      id: 201,
      conversationId: 2,
      sender: "Dr. Anita Wijaya, M.Psi.",
      initials: "AW",
      content: "Selamat siang Wahyu. Senang bertemu kembali di sesi konseling hari ini. Bagaimana evaluasi latihan regulasi napas selama sepekan terakhir?",
      time: "14:00",
      isUser: false,
    },
    {
      id: 202,
      conversationId: 2,
      sender: "Kamu",
      content: "Siang Dok. Saya sudah coba latihan diafragma tiap malam, cukup membantu menenangkan. Tapi kalau pagi hari sebelum berangkat kantor, detak jantung masih sering berdegup kencang.",
      time: "14:02",
      isUser: true,
    },
    {
      id: 203,
      conversationId: 2,
      sender: "Dr. Anita Wijaya, M.Psi.",
      initials: "AW",
      content: "Catatan yang sangat baik, Wahyu. Ini menandakan pola *anticipatory anxiety*. Hari ini kita akan fokus pada restrukturisasi kognitif untuk memetakan pikiran otomatis (automatic thoughts) di pagi hari tersebut.",
      time: "14:04",
      isUser: false,
    },
  ],
  3: [
    {
      id: 301,
      conversationId: 3,
      sender: "Budi Santoso, M.Psi., Psikolog",
      initials: "BS",
      content: "Halo Wahyu, bagaimana perkembangan jurnal pemetaan pemicu stres yang kita susun di sesi sebelumnya?",
      time: "Kemarin 16:00",
      isUser: false,
    },
  ],
  4: [
    {
      id: 401,
      conversationId: 4,
      sender: "Dewi (Pendengar Sebaya)",
      initials: "DW",
      content: "Halo! Selamat datang di ruang curhat aman ini. Nama samaranku Dewi. Aku di sini untuk mendengarkan ceritamu dengan penuh penerimaan tanpa menghakimi. Apa yang sedang memenuhi perasaanmu malam ini?",
      time: "20:00",
      isUser: false,
    },
  ],
};

const initialClinicalNotes: Record<number, ClinicalNoteRecord> = {
  2: {
    s: "Klien melaporkan anticipatory anxiety berulang setiap pagi sebelum jam kantor. Mengalami somatic tension (dada sesak ringan, jantung berdebar). Latihan napas diafragma malam hari cukup efektif membantu onset tidur.",
    o: "Afek cemas ringan, kontak mata baik, speech rate normal. Insight klinis baik (grade 5, sadar akan pola pemicu kecemasan).",
    a: "F41.1 - Gangguan Cemas Menyeluruh dengan kecenderungan catastrophizing terhadap beban kerja kuartal akhir.",
    p: "1. Psikoedukasi CBT restrukturisasi pikiran otomatis (3-column technique).\n2. Latihan grounding 5-4-3-2-1 saat morning routine.\n3. Pertahankan jadwal tidur konsisten jam 23.00.",
    updatedAt: "10 Okt 2026, 14:15 WIB",
  },
};

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<number, Message[]>;
  messages: Message[];
  selectedConversation: Conversation | null;
  isAnonymous: boolean;
  searchQuery: string;
  clinicalNotes: Record<number, ClinicalNoteRecord>;

  // Actions
  setSelectedConversation: (conversation: Conversation | null) => void;
  setIsAnonymous: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  sendMessage: (content: string) => void;
  sendRichMessage: (params: {
    content?: string;
    audioUrl?: string;
    audioDuration?: string;
    attachment?: Attachment;
  }) => void;
  sendCounselorReply: (convId: number, content: string) => void;
  sendPeerListenerReply: (convId: number, content: string) => void;
  sendPatientSimulationReply: (convId: number, content: string) => void;
  updateClinicalNote: (convId: number, note: Partial<ClinicalNoteRecord>) => void;
  getFilteredConversations: () => Conversation[];
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: initialConversations,
      messagesByConversation: initialMessagesByConv,
      messages: initialMessagesByConv[1] || [],
      selectedConversation: initialConversations[0],
      isAnonymous: false,
      searchQuery: "",
      clinicalNotes: initialClinicalNotes,

      setSelectedConversation: (conversation) => {
        if (!conversation) {
          set({ selectedConversation: null, messages: [] });
          return;
        }
        const msgs = get().messagesByConversation[conversation.id] || [];
        set({
          selectedConversation: conversation,
          messages: msgs,
        });
      },

      setIsAnonymous: (value) => set({ isAnonymous: value }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      sendMessage: (content) => {
        get().sendRichMessage({ content });
      },

      sendRichMessage: ({ content = "", audioUrl, audioDuration, attachment }) => {
        const { selectedConversation, messagesByConversation } = get();
        if (!selectedConversation) return;
        if (!content.trim() && !audioUrl && !attachment) return;

        const convId = selectedConversation.id;
        const currentMsgs = messagesByConversation[convId] || [];
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        // Buat pesan pengguna
        const userMessage: Message = {
          id: Date.now(),
          conversationId: convId,
          sender: "Kamu",
          content: content.trim(),
          time: nowTime,
          isUser: true,
          audioUrl,
          audioDuration,
          attachment,
        };

        const updatedMsgs = [...currentMsgs, userMessage];

        // Update list conversation last message
        const updatedConversations = get().conversations.map((c) =>
          c.id === convId
            ? { ...c, lastMessage: content.trim() || (audioUrl ? "Pesan suara" : "Lampiran berkas"), time: "Baru saja" }
            : c
        );

        set({
          conversations: updatedConversations,
          messagesByConversation: {
            ...messagesByConversation,
            [convId]: updatedMsgs,
          },
          messages: updatedMsgs,
        });

        // Respon otomatis simulasi untuk AI & Pendengar Sebaya
        if (selectedConversation.isAI || selectedConversation.isPeerListener) {
          setTimeout(() => {
            let replyText = `Aku mendengarmu. Kamu menyampaikan: "${content}". Ambil napas sejenak, kita telaah perasaan ini perlahan.`;

            if (audioUrl) {
              replyText = `Terima kasih telah membagikan rekaman suaramu. Menyampaikan perasaan secara verbal adalah langkah katarsis yang luar biasa.`;
            } else if (attachment) {
              replyText = `Berkas "${attachment.name}" telah terenkripsi aman dan dimasukkan ke catatan sesi konseling kita.`;
            } else if (selectedConversation.isAI) {
              replyText = `Aku memahami beban yang kamu rasakan terkait "${content}". Tubuhmu sedang memberi sinyal butuh jeda. Cobalah rilekskan bahumu sekarang, apa yang paling memberatkanmu?`;
            } else if (selectedConversation.isPeerListener) {
              replyText = `Terima kasih sudah begitu terbuka bercerita kepadaku. Menghadapi situasi itu pasti tidak mudah ya. Aku ada di sini mendengarkanmu.`;
            }

            const replyMessage: Message = {
              id: Date.now() + 1,
              conversationId: convId,
              sender: selectedConversation.name,
              initials: selectedConversation.initials,
              content: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isUser: false,
            };

            const latestMsgs = [...(get().messagesByConversation[convId] || []), replyMessage];
            set({
              messagesByConversation: {
                ...get().messagesByConversation,
                [convId]: latestMsgs,
              },
              messages: get().selectedConversation?.id === convId ? latestMsgs : get().messages,
            });
          }, 1100);
        }
      },

      sendCounselorReply: (convId, content) => {
        if (!content.trim()) return;
        const currentMsgs = get().messagesByConversation[convId] || [];
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const counselorMsg: Message = {
          id: Date.now(),
          conversationId: convId,
          sender: "Dr. Anita Wijaya, M.Psi.",
          senderRole: "counselor",
          initials: "AW",
          content: content.trim(),
          time: nowTime,
          isUser: false,
        };

        const updatedMsgs = [...currentMsgs, counselorMsg];

        set({
          conversations: get().conversations.map((c) =>
            c.id === convId ? { ...c, lastMessage: content.trim(), time: "Baru saja" } : c
          ),
          messagesByConversation: {
            ...get().messagesByConversation,
            [convId]: updatedMsgs,
          },
          messages: get().selectedConversation?.id === convId ? updatedMsgs : get().messages,
        });
      },

      sendPeerListenerReply: (convId, content) => {
        if (!content.trim()) return;
        const currentMsgs = get().messagesByConversation[convId] || [];
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const listenerMsg: Message = {
          id: Date.now(),
          conversationId: convId,
          sender: "Dewi (Pendengar Sebaya)",
          senderRole: "peer_listener",
          initials: "DW",
          content: content.trim(),
          time: nowTime,
          isUser: false,
        };

        const updatedMsgs = [...currentMsgs, listenerMsg];

        set({
          conversations: get().conversations.map((c) =>
            c.id === convId ? { ...c, lastMessage: content.trim(), time: "Baru saja" } : c
          ),
          messagesByConversation: {
            ...get().messagesByConversation,
            [convId]: updatedMsgs,
          },
          messages: get().selectedConversation?.id === convId ? updatedMsgs : get().messages,
        });
      },

      sendPatientSimulationReply: (convId, content) => {
        if (!content.trim()) return;
        const currentMsgs = get().messagesByConversation[convId] || [];
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const patientMsg: Message = {
          id: Date.now(),
          conversationId: convId,
          sender: "Wahyu Tricahyo",
          senderRole: "patient",
          initials: "WT",
          content: content.trim(),
          time: nowTime,
          isUser: true,
        };

        const updatedMsgs = [...currentMsgs, patientMsg];

        set({
          conversations: get().conversations.map((c) =>
            c.id === convId ? { ...c, lastMessage: content.trim(), time: "Baru saja" } : c
          ),
          messagesByConversation: {
            ...get().messagesByConversation,
            [convId]: updatedMsgs,
          },
          messages: get().selectedConversation?.id === convId ? updatedMsgs : get().messages,
        });
      },

      updateClinicalNote: (convId, note) => {
        const current = get().clinicalNotes[convId] || {
          s: "",
          o: "",
          a: "",
          p: "",
          updatedAt: "",
        };

        const updated: ClinicalNoteRecord = {
          ...current,
          ...note,
          updatedAt:
            "Hari Ini, " +
            new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
            " WIB",
        };

        set({
          clinicalNotes: {
            ...get().clinicalNotes,
            [convId]: updated,
          },
        });
      },

      getFilteredConversations: () => {
        const { conversations, searchQuery } = get();
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
          (conv) =>
            conv.name.toLowerCase().includes(q) ||
            conv.role.toLowerCase().includes(q) ||
            conv.lastMessage.toLowerCase().includes(q)
        );
      },
    }),
    {
      name: "tb_chat_store_v3",
      version: 3,
      migrate: (persistedState: unknown) => {
        const state = persistedState as Partial<ChatState> | undefined;
        if (!state) return state as unknown as ChatState;
        if (state.conversations && !state.conversations.some((c) => c.isPeerListener || c.id === 4)) {
          const peerConv = initialConversations.find((c) => c.id === 4);
          if (peerConv) {
            state.conversations = [...state.conversations, peerConv];
          }
        }
        if (state.messagesByConversation && !state.messagesByConversation[4]) {
          state.messagesByConversation[4] = initialMessagesByConv[4] || [];
        }
        return state as unknown as ChatState;
      },
    }
  )
);
