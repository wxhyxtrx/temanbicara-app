"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ChevronRight, MoreVertical } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";

export function ChatHeader() {
  const { selectedConversation, setSelectedConversation } = useChatStore();
  const isMobile = useIsMobile();

  if (!selectedConversation) return null;

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="flex items-center justify-between pb-3 border-b flex-shrink-0">
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
            <CardTitle className="font-medium text-base sm:text-lg line-clamp-1 overflow-ellipsis">{selectedConversation.name}</CardTitle>
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
  );
}