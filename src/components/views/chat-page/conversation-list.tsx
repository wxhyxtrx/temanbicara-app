"use client";

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useChatStore } from '@/store/chat-store';
import { useIsMobile } from '@/hooks/use-mobile';

export function ConversationList() {
  const { 
    selectedConversation,
    setSelectedConversation,
    isAnonymous,
    setIsAnonymous,
    searchQuery,
    setSearchQuery,
    getFilteredConversations
  } = useChatStore();
  
  const isMobile = useIsMobile();
  const filteredConversations = getFilteredConversations();

  return (
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
  );
}