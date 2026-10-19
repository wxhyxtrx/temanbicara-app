"use client";

import React, { useRef, useEffect, useState } from "react";
import { useChatStore, Message } from "@/store/chat-store";
import {
  Lock,
  Bot,
  CheckCheck,
  Play,
  Pause,
  FileText,
  Download,
} from "lucide-react";

export function MessageList() {
  const { messages, selectedConversation } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio play state per message ID
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);

  // Scroll otomatis ke pesan terbaru
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const togglePlayAudio = (messageId: number) => {
    if (playingAudioId === messageId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(messageId);
      // Auto reset after 5 seconds simulation
      setTimeout(() => {
        setPlayingAudioId((curr) => (curr === messageId ? null : curr));
      }, 5000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/60 dark:bg-slate-950/70 space-y-4 font-nunito transition-colors duration-200">
      {/* Badge Privasi Ringkas */}
      <div className="flex items-center justify-center pt-0.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-medium select-none shadow-2xs">
          <Lock size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Percakapan privat & rahasia</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="space-y-3.5 pt-1">
        {messages.map((message: Message) => {
          const isUser = message.isUser;
          const isAudio = Boolean(message.audioUrl);
          const hasAttachment = Boolean(message.attachment);

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex gap-2 sm:gap-2.5 max-w-[88%] sm:max-w-[78%] ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Consultant/AI Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-[11px] flex items-center justify-center border border-teal-200 dark:border-teal-800 shrink-0 font-heading mt-1">
                    {selectedConversation?.isAI ? (
                      <Bot size={15} className="text-teal-700 dark:text-teal-400" />
                    ) : (
                      message.initials || "P"
                    )}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className="space-y-1.5 max-w-full">
                  {/* Bubble Utama */}
                  <div
                    className={`p-3 sm:p-3.5 text-xs sm:text-sm leading-relaxed transition-shadow space-y-2.5 ${
                      isUser
                        ? "bg-teal-600 text-white rounded-2xl rounded-tr-xs shadow-xs"
                        : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-xs shadow-xs"
                    }`}
                  >
                    {/* A. File Attachment View */}
                    {hasAttachment && message.attachment && (
                      <div className="rounded-xl overflow-hidden space-y-1.5">
                        {message.attachment.type === "image" ? (
                          <div className="rounded-lg overflow-hidden border border-white/20 max-w-xs">
                            <img
                              src={message.attachment.url}
                              alt={message.attachment.name}
                              className="w-full max-h-56 object-cover"
                            />
                            <p className="text-[10px] p-1.5 opacity-80 truncate">
                              {message.attachment.name}
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                              isUser
                                ? "bg-teal-700/60 border-teal-500/70 text-white"
                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isUser ? "bg-teal-800 text-white" : "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300"
                                }`}
                              >
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-xs truncate max-w-[180px]">
                                  {message.attachment.name}
                                </p>
                                <p className="text-[10px] opacity-75">{message.attachment.size || "PDF Medis"}</p>
                              </div>
                            </div>

                            <a
                              href={message.attachment.url}
                              download={message.attachment.name}
                              target="_blank"
                              rel="noreferrer"
                              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 ${
                                isUser ? "bg-teal-500 hover:bg-teal-400 text-slate-950" : "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 hover:bg-teal-200"
                              }`}
                              title="Unduh Lampiran"
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* B. Voice Note Player View */}
                    {isAudio ? (
                      <div className="flex items-center gap-3 py-1">
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(message.id)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs ${
                            isUser
                              ? "bg-white text-teal-800 hover:bg-teal-50"
                              : "bg-teal-600 text-white hover:bg-teal-700"
                          }`}
                          aria-label="Putar rekaman suara"
                        >
                          {playingAudioId === message.id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                        </button>

                        <div className="space-y-1 min-w-[140px] sm:min-w-[180px]">
                          {/* Animated Waveform Bars */}
                          <div className="flex items-center gap-0.5 h-6">
                            {[30, 60, 45, 90, 40, 75, 55, 85, 35, 65, 50, 80, 40, 60].map((h, i) => (
                              <span
                                key={i}
                                style={{ height: `${h}%` }}
                                className={`w-1 rounded-full transition-all duration-200 ${
                                  playingAudioId === message.id
                                    ? isUser
                                      ? "bg-white animate-pulse"
                                      : "bg-teal-600 animate-pulse"
                                    : isUser
                                    ? "bg-teal-200/80"
                                    : "bg-slate-300 dark:bg-slate-700"
                                }`}
                              />
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
                            <span>{playingAudioId === message.id ? "Memutar..." : "Voice Note"}</span>
                            <span>{message.audioDuration || "0:12"}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* C. Regular Text Content */
                      message.content && <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Timestamp & Read Status */}
                  <div
                    className={`flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-nunito px-1 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{message.time}</span>
                    {isUser && <CheckCheck size={12} className="text-teal-600 dark:text-teal-400" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
