"use client";

import React from "react";
import { Search, EyeOff, User, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useChatStore, Conversation } from "@/store/chat-store";
import { useUserStore } from "@/store/user-store";
import { MdVerified } from "react-icons/md";

export function ConversationList() {
  const {
    selectedConversation,
    setSelectedConversation,
    isAnonymous,
    setIsAnonymous,
    searchQuery,
    setSearchQuery,
    getFilteredConversations,
  } = useChatStore();
  const { user } = useUserStore();

  const filteredConversations = getFilteredConversations();

  return (
    <Card className="h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col rounded-2xl overflow-hidden font-nunito transition-colors duration-200">
      {/* Header Profil & Mode Anonim */}
      <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/90">
        {/* User Identity Profile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center border shrink-0 font-heading transition-all duration-200 ${
                isAnonymous
                  ? "bg-slate-900 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700 shadow-xs"
                  : "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
              }`}
            >
              {isAnonymous ? <EyeOff size={18} /> : (user.avatarInitials || "WT")}
            </div>
            <div className="min-w-0">
              <CardTitle className="font-heading text-sm font-bold text-slate-900 dark:text-white truncate">
                {isAnonymous ? "Pengguna Anonim" : (user.fullName || "Wahyu Tricahyo")}
              </CardTitle>
              <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                    isAnonymous ? "bg-emerald-500" : "bg-teal-600 dark:bg-teal-400"
                  }`}
                />
                <span className={isAnonymous ? "text-teal-700 dark:text-teal-300 font-semibold" : "text-slate-500 dark:text-slate-400"}>
                  {isAnonymous ? "Identitas Disamarkan 100%" : "Pasien Terverifikasi"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Switch Card Mode Anonim */}
        <div
          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-200 text-xs ${
            isAnonymous
              ? "bg-teal-50/90 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-950 dark:text-teal-200 shadow-2xs"
              : "bg-white dark:bg-slate-800/70 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isAnonymous
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
              }`}
            >
              {isAnonymous ? <EyeOff size={14} /> : <User size={14} />}
            </div>
            <div className="min-w-0">
              <span className="font-bold block leading-tight text-slate-900 dark:text-white text-xs">
                {isAnonymous ? "Mode Anonim Aktif" : "Mode Anonim"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                {isAnonymous ? "Nama & inisial asli disamarkan" : "Samarkan identitasmu di sesi chat"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pl-2">
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              className="cursor-pointer"
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
          <Input
            placeholder="Cari sesi atau psikolog..."
            className="pl-9 h-9 text-xs bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>

      {/* Conversation Thread List */}
      <CardContent className="overflow-y-auto flex-grow p-2 sm:p-2.5 space-y-1">
        <div className="px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Ruang Percakapan Aktif
        </div>

        {filteredConversations.length > 0 ? (
          filteredConversations.map((conv: Conversation) => {
            const isSelected = selectedConversation?.id === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-3 rounded-xl cursor-pointer transition-all duration-150 border ${
                  isSelected
                    ? "bg-teal-50/70 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 shadow-2xs"
                    : "bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-100 dark:hover:border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Left: Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center border font-heading ${
                        conv.isAI
                          ? "bg-teal-600 text-white border-teal-700"
                          : "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                      }`}
                    >
                      {conv.isAI ? <Bot size={18} /> : conv.initials}
                    </div>
                    {conv.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    )}
                  </div>

                  {/* Center: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading truncate">
                        {conv.name}
                      </p>
                      {!conv.isAI && <MdVerified className="text-sky-500 text-xs shrink-0" />}
                    </div>

                    <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate mt-0.5">
                      {conv.role}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito line-clamp-1 mt-0.5 leading-normal">
                      {conv.lastMessage}
                    </p>
                  </div>

                  {/* Right: Timestamp & Unread Badge Counter */}
                  <div className="flex flex-col items-end justify-between shrink-0 self-stretch py-0.5 pl-1">
                    <span
                      className={`text-[10px] font-nunito ${
                        conv.unread > 0 ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {conv.time}
                    </span>

                    {conv.unread > 0 ? (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shadow-2xs mt-1">
                        {conv.unread}
                      </span>
                    ) : (
                      <span className="h-5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
            Tidak ada percakapan yang cocok.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
