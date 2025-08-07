"use client";

import { useEffect } from 'react';
import { ConversationList } from "@/components/views/chat-page/conversation-list";
import { useChatStore } from "@/store/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatArea } from '@/components/views/chat-page/chat-area';

function RoomChatPage() {
  const { selectedConversation, setSelectedConversation, conversations } = useChatStore();
  const isMobile = useIsMobile();

  // Efek untuk memilih percakapan pertama secara otomatis di desktop
  useEffect(() => {
    // Jika layar besar (desktop/tablet), otomatis pilih percakapan pertama
    if (!isMobile && !selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [isMobile, selectedConversation, setSelectedConversation, conversations]);

  return (
    <div className="min-h-full font-nunito">
      <div className="h-[calc(100vh-100px)]">
        {(!selectedConversation || !isMobile) && (
          <div className={`h-full ${selectedConversation && !isMobile ? 'hidden lg:block md:w-[350px] lg:w-[380px] float-left mr-6' : 'w-full'}`}>
            <ConversationList />
          </div>
        )}
        {selectedConversation && (
          <div className={`h-full ${!isMobile ? 'lg:ml-[350px] 2xl:ml-[380px]' : 'w-full'}`}>
            <ChatArea />
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomChatPage;
