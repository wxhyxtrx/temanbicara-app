"use client";

import { Card } from "@/components/ui/card";
import { useChatStore } from "@/store/chat-store";
import { ChatHeader } from "./chat-header";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

export function ChatArea() {
  const { selectedConversation } = useChatStore();

  if (!selectedConversation) return null;

  return (
    <Card className="h-full flex flex-col bg-card shadow-md gap-0">
      <div className="p-3 sm:p-4">
        <ChatHeader />
      </div>
      <MessageList />
      <MessageInput />
    </Card>
  );
}