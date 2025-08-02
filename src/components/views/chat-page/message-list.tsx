"use client";

import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatStore } from "@/store/chat-store";

export function MessageList() {
  const { messages } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fungsi untuk scroll otomatis ke pesan terbaru
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll ke bawah saat pesan baru ditambahkan
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-secondary-background/30">
      <div className="space-y-4">
        {messages.map((message) => (
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
    </div>
  );
}