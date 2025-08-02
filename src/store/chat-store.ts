import { create } from 'zustand';

// Tipe untuk data percakapan
export interface Conversation {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  isAI: boolean;
}

// Tipe untuk pesan
export interface Message {
  id: number;
  sender: string;
  avatar?: string;
  content: string;
  time: string;
  isUser: boolean;
}

// Data percakapan dummy
const initialConversations: Conversation[] = [
  {
    id: 1,
    name: "TemanBicara AI",
    avatar: "/images/mascot1.png",
    lastMessage: "Hai, apa yang ingin kamu bicarakan hari ini?",
    time: "Baru saja",
    unread: 0,
    isAI: true,
  },
  {
    id: 2,
    name: "Dr. Anita Wijaya",
    avatar: "/images/mascot1.png",
    lastMessage: "Jangan lupa latihan pernapasan yang sudah kita bahas ya.",
    time: "3 jam lalu",
    unread: 2,
    isAI: false,
  },
  {
    id: 3,
    name: "Budi Santoso, M.Psi",
    avatar: "/images/mascot1.png",
    lastMessage: "Bagaimana perkembangan tugas yang kita diskusikan kemarin?",
    time: "Kemarin",
    unread: 0,
    isAI: false,
  },
];

// Data pesan dummy untuk percakapan yang dipilih
const initialMessages: Message[] = [
  {
    id: 1,
    sender: "TemanBicara AI",
    avatar: "/images/mascot1.png",
    content: "Halo! Selamat datang di TemanBicara. Apa yang ingin kamu bicarakan hari ini?",
    time: "10:00",
    isUser: false,
  },
  {
    id: 2,
    sender: "Kamu",
    content: "Hai, aku merasa sedikit cemas akhir-akhir ini.",
    time: "10:02",
    isUser: true,
  },
  {
    id: 3,
    sender: "TemanBicara AI",
    avatar: "/images/mascot1.png",
    content: "Aku mengerti. Kecemasan adalah hal yang normal dirasakan. Bisa kamu ceritakan lebih detail apa yang membuatmu cemas?",
    time: "10:03",
    isUser: false,
  },
  {
    id: 4,
    sender: "Kamu",
    content: "Aku punya beberapa deadline pekerjaan yang menumpuk, dan aku khawatir tidak bisa menyelesaikannya tepat waktu.",
    time: "10:05",
    isUser: true,
  },
  {
    id: 5,
    sender: "TemanBicara AI",
    avatar: "/images/mascot1.png",
    content: "Terima kasih sudah berbagi. Menghadapi deadline yang menumpuk memang bisa membuat cemas. Mari kita coba beberapa strategi untuk mengelola kecemasan dan tugas-tugasmu. Pertama, apakah kamu sudah mencoba membuat daftar prioritas?",
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
  getFilteredConversations: () => Conversation[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: initialConversations,
  messages: initialMessages,
  selectedConversation: null,
  isAnonymous: false,
  searchQuery: "",
  
  setSelectedConversation: (conversation) => set({ selectedConversation: conversation }),
  setIsAnonymous: (value) => set({ isAnonymous: value }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  sendMessage: (content) => {
    const { selectedConversation, messages } = get();
    
    if (!content.trim() || !selectedConversation) return;
    
    // Buat objek pesan baru
    const newMessage: Message = {
      id: messages.length + 1,
      sender: "Kamu",
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
    };
    
    // Tambahkan pesan baru ke daftar pesan
    set({ messages: [...messages, newMessage] });
    
    // Simulasi balasan dari AI atau konsultan setelah 1 detik
    setTimeout(() => {
      const replyMessage: Message = {
        id: get().messages.length + 1,
        sender: selectedConversation.name,
        avatar: selectedConversation.avatar,
        content: `Terima kasih atas pesanmu. Ini adalah balasan otomatis untuk: "${content}"`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
      };
      set({ messages: [...get().messages, replyMessage] });
    }, 1000);
  },
  
  getFilteredConversations: () => {
    const { conversations, searchQuery } = get();
    return conversations.filter(conv => 
      conv.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  },
}));