"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Image, Plus, Mic, Smile, Send } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";

export function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const { sendMessage } = useChatStore();
  const isMobile = useIsMobile();

  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;
    sendMessage(newMessage);
    setNewMessage("");
  };

  return (
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
  );
}