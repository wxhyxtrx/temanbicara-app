import { create } from 'zustand';

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
  statusText: string;
  online: boolean;
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
  sender: string;
  avatar?: string;
  initials?: string;
  content: string;
  time: string;
  isUser: boolean;
  audioUrl?: string;
  audioDuration?: string;
  attachment?: Attachment;
}

// Data percakapan psikologis & AI
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
  },
];

// Data pesan dummy untuk percakapan yang dipilih
const initialMessages: Message[] = [
  {
    id: 1,
    sender: "TemanBicara AI Empatik",
    initials: "TB",
    content: "Halo! Selamat datang di ruang tenangmu. Apa pun yang kamu rasakan hari ini valid dan aman untuk diungkapkan. Apa yang ingin kamu bagikan?",
    time: "10:00",
    isUser: false,
  },
  {
    id: 2,
    sender: "Kamu",
    content: "Halo. Aku merasa sangat cemas dan kepikiran pekerjaan terus-menerus beberapa hari ini. Rasanya dada sesak dan sulit tidur.",
    time: "10:02",
    isUser: true,
  },
  {
    id: 3,
    sender: "TemanBicara AI Empatik",
    initials: "TB",
    content: "Terima kasih sudah berani mengungkapkan ini. Mengalami kecemasan hingga memengaruhi fisik seperti dada sesak tentu melelahkan. Apakah kamu bersedia mengambil 1 menit jeda bersama untuk latihan napas perlahan, atau kamu ingin terus bercerita?",
    time: "10:03",
    isUser: false,
  },
  {
    id: 4,
    sender: "Kamu",
    content: "Aku ingin cerita dulu sebentar. Tuntutan deadline menumpuk dan aku takut mengecewakan timku jika tidak selesai sempurna.",
    time: "10:05",
    isUser: true,
  },
  {
    id: 5,
    sender: "TemanBicara AI Empatik",
    initials: "TB",
    content: "Ketakutan akan mengecewakan orang lain sering kali menaruh beban berlebih di pundak kita. Ingat bahwa nilaimu tidak hanya diukur dari produktivitasmu. Mari kita pilah satu per satu tugas yang paling realistis diselesaikan hari ini.",
    time: "10:07",
    isUser: false,
  },
];

interface ChatState {
  conversations: Conversation[];
  messages: Message[];
  selectedConversation: Conversation | null;
  isAnonymous: boolean;
  searchQuery: string;
  
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
  getFilteredConversations: () => Conversation[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: initialConversations,
  messages: initialMessages,
  selectedConversation: initialConversations[0],
  isAnonymous: false,
  searchQuery: "",
  
  setSelectedConversation: (conversation) => set({ selectedConversation: conversation }),
  setIsAnonymous: (value) => set({ isAnonymous: value }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  sendMessage: (content) => {
    get().sendRichMessage({ content });
  },

  sendRichMessage: ({ content = "", audioUrl, audioDuration, attachment }) => {
    const { selectedConversation, messages } = get();
    if (!selectedConversation) return;
    if (!content.trim() && !audioUrl && !attachment) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Buat pesan pengguna
    const userMessage: Message = {
      id: messages.length + 1,
      sender: "Kamu",
      content: content.trim(),
      time: nowTime,
      isUser: true,
      audioUrl,
      audioDuration,
      attachment,
    };

    set({ messages: [...messages, userMessage] });

    // Respon terapeutik otomatis simulasi
    setTimeout(() => {
      let replyText = `Aku mendengarmu. Kamu menyampaikan: "${content}". Ambil napas sejenak, kita bisa telaah perasaan ini perlahan-lahan.`;

      if (audioUrl) {
        replyText = `Terima kasih telah membagikan rekaman suaramu. Menyampaikan perasaan secara verbal adalah langkah katarsis yang luar biasa. Tarik napas perlahan, ceritakan lebih lanjut bila sudah siap.`;
      } else if (attachment) {
        replyText = `Berkas rekam medis/lampiran "${attachment.name}" telah tersimpan secara aman dan terenkripsi. Saya akan memasukkannya ke dalam catatan sesi konseling kita.`;
      } else if (selectedConversation.isAI) {
        replyText = `Aku memahami beban yang kamu rasakan terkait "${content}". Tubuhmu sedang memberi sinyal butuh jeda. Cobalah rilekskan bahumu sekarang, dan ceritakan bagian mana yang paling berat.`;
      } else {
        replyText = `Halo, catatan konselingmu sudah saya terima. Saya akan merefleksikan ini di sesi terapi kita berikutnya. Jaga pernapasan tetap tenang ya.`;
      }

      const replyMessage: Message = {
        id: get().messages.length + 1,
        sender: selectedConversation.name,
        initials: selectedConversation.initials,
        content: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
      };

      set({ messages: [...get().messages, replyMessage] });
    }, 1200);
  },
  
  getFilteredConversations: () => {
    const { conversations, searchQuery } = get();
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.name.toLowerCase().includes(q) || 
      conv.role.toLowerCase().includes(q) ||
      conv.lastMessage.toLowerCase().includes(q)
    );
  },
}));
