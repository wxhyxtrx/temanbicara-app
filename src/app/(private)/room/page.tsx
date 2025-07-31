"use client";

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Search, Plus, Send, Paperclip, Smile, ChevronRight, MoreVertical, Image, File, Mic, ArrowLeft } from "lucide-react";

// Tipe untuk data percakapan
interface Conversation {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  isAI: boolean;
}

// Tipe untuk pesan
interface Message {
  id: number;
  sender: string;
  avatar?: string;
  content: string;
  time: string;
  isUser: boolean;
}

// Data percakapan dummy
const conversations: Conversation[] = [
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
const messages: Message[] = [
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

function RoomChatPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>(messages);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fungsi untuk scroll otomatis ke pesan terbaru
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll ke bawah saat pesan baru ditambahkan
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Fungsi untuk menangani perubahan ukuran layar
  useEffect(() => {
    // Fungsi untuk mendeteksi ukuran layar
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Jika layar besar (desktop/tablet), otomatis pilih percakapan pertama
      if (!mobile && !selectedConversation) {
        setSelectedConversation(conversations[0]);
      }
    };

    // Set nilai awal setelah komponen di-mount (client-side)
    if (typeof window !== 'undefined') {
      handleResize();
      // Tambahkan event listener
      window.addEventListener('resize', handleResize);
    }

    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [selectedConversation]);

  const handleSendMessage = () => {
    if (newMessage.trim() === "" || !selectedConversation) return;
    
    // Buat objek pesan baru
    const newChatMessage: Message = {
      id: chatMessages.length + 1,
      sender: "Kamu",
      content: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
    };
    
    // Tambahkan pesan baru ke daftar pesan
    setChatMessages([...chatMessages, newChatMessage]);
    
    // Reset input pesan
    setNewMessage("");
    
    // Simulasi balasan dari AI atau konsultan setelah 1 detik
    setTimeout(() => {
      const replyMessage: Message = {
        id: chatMessages.length + 2,
        sender: selectedConversation.name,
        avatar: selectedConversation.avatar,
        content: `Terima kasih atas pesanmu. Ini adalah balasan otomatis untuk: "${newMessage}"`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
      };
      setChatMessages(prevMessages => [...prevMessages, replyMessage]);
    }, 1000);
  };

  const filteredConversations = conversations.filter(conv => 
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="min-h-full font-nunito">
      <div className="h-[calc(100vh-140px)]">
        {/* Tampilan Daftar Chat (Tampil di mobile saat tidak ada chat yang dipilih, atau selalu tampil di desktop) */}
        {(!selectedConversation || !isMobile) && (
          <div className={`h-full ${selectedConversation && !isMobile ? 'hidden md:block md:w-[350px] lg:w-[380px] float-left mr-6' : 'w-full'}`}>
            <Card className="h-full bg-card shadow-md flex flex-col">
              <CardHeader className="pb-2 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border-2 border-primary/20">
                      <AvatarImage src="/images/mascot1.png" alt="User" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="font-poppins text-lg">Pranita Sakhare</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">User</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Anonim</span>
                          <Switch
                            checked={isAnonymous}
                            onCheckedChange={setIsAnonymous}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    placeholder="Cari percakapan..."
                    className="pl-9 bg-secondary-background border-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="overflow-y-auto flex-grow pt-2">
                <div className="space-y-2">
                  {filteredConversations.map((conv) => (
                    <div 
                      key={conv.id} 
                      className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-secondary-background`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-primary/20">
                          <AvatarImage src={conv.avatar} alt={conv.name} />
                          <AvatarFallback>{conv.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{conv.name}</p>
                              {conv.isAI && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                  AI
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{conv.time}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{conv.lastMessage}</p>
                        </div>
                      </div>
                      {conv.unread > 0 && (
                        <div className="flex justify-end mt-1">
                          <Badge className="bg-primary text-white text-xs">{conv.unread}</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Area Chat - Tampil saat ada chat yang dipilih */}
        {selectedConversation && (
          <div className={`h-full ${!isMobile ? 'md:ml-[350px] lg:ml-[380px]' : 'w-full'}`}>
            <Card className="h-full flex flex-col bg-card shadow-md gap-0">
              {/* Header Chat */}
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full mr-1"
                        onClick={handleBackToList}
                      >
                        <ArrowLeft size={18} />
                      </Button>
                    )}
                    <Avatar className="w-10 h-10 border-2 border-primary/20">
                      <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.name} />
                      <AvatarFallback>{selectedConversation.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-medium text-base sm:text-lg">{selectedConversation.name}</CardTitle>
                        {selectedConversation.isAI && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                            AI
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        {selectedConversation.isAI ? 'Selalu siap mendengarkan' : 'Terakhir online 2 jam lalu'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-primary gap-1 hidden sm:flex">
                      Lihat Profil <ChevronRight size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <MoreVertical size={18} className="text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Isi Chat */}
              <CardContent className="flex-1 overflow-y-auto p-2 sm:p-4 bg-secondary-background/30">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-2 sm:gap-3 max-w-[85%] sm:max-w-[80%] ${message.isUser ? 'flex-row-reverse' : ''}`}>
                        {!message.isUser && (
                          <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border border-primary/20">
                            <AvatarImage src={message.avatar} alt={message.sender} />
                            <AvatarFallback>{message.sender.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          <div 
                            className={`p-2 sm:p-3 rounded-lg ${message.isUser 
                              ? 'bg-primary text-white' 
                              : 'bg-card'}`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-right">{message.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              {/* Input Chat */}
              <div className="p-2 sm:p-4 border-t bg-card flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
                      <Paperclip size={18} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
                      <Image size={18} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full sm:hidden">
                      <Plus size={18} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Mic size={18} className="text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      placeholder="Type a message..."
                      className="pr-10 bg-secondary-background/50 border-0"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 rounded-full">
                      <Smile size={18} className="text-muted-foreground" />
                    </Button>
                  </div>
                  <Button 
                    size="icon" 
                    className="rounded-full bg-primary hover:bg-primary/90"
                    onClick={handleSendMessage}
                    disabled={newMessage.trim() === ""}
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoomChatPage
