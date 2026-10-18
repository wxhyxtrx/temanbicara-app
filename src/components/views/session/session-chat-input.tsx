"use client";

import React, { useRef } from "react";
import { Send, Image as ImageIcon, Mic, Square, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SessionChatInputProps {
  isReadOnly: boolean;
  inputMessage: string;
  setInputMessage: (val: string) => void;
  isSending: boolean;
  uploadingImage: boolean;
  isRecording: boolean;
  recordSeconds: number;
  onSendText: () => void;
  onSelectImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onCancelRecording: () => void;
  onStopAndSendVoiceNote: () => void;
}

export function SessionChatInput({
  isReadOnly,
  inputMessage,
  setInputMessage,
  isSending,
  uploadingImage,
  isRecording,
  recordSeconds,
  onSendText,
  onSelectImage,
  onStartRecording,
  onCancelRecording,
  onStopAndSendVoiceNote,
}: SessionChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatRecordTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 font-nunito">
      {isReadOnly ? (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Sesi konseling telah selesai
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
            Ruang percakapan ini kini berada dalam mode hanya-baca (read-only).
          </p>
        </div>
      ) : isRecording ? (
        /* Voice Recording Bar */
        <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl px-4 py-2 text-rose-900 dark:text-rose-100 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold font-mono">
              Merekam: {formatRecordTime(recordSeconds)}
            </span>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-normal hidden sm:inline">
              (Maks. 2 menit)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancelRecording}
              className="h-7 px-2.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-lg gap-1 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Batal</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onStopAndSendVoiceNote}
              className="h-7 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg gap-1 shadow-xs font-semibold cursor-pointer"
            >
              <Square size={12} className="fill-current" />
              <span>Kirim</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Normal Chat Input Bar */
        <div className="flex items-center gap-2">
          {/* Hidden File Input for Image */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={onSelectImage}
            className="hidden"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploadingImage || isSending}
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 p-0 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            title="Kirim Foto (JPG/PNG/WebP)"
          >
            {uploadingImage ? (
              <Loader2 size={18} className="animate-spin text-teal-600" />
            ) : (
              <ImageIcon size={18} />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploadingImage || isSending}
            onClick={onStartRecording}
            className="w-9 h-9 p-0 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            title="Rekam Pesan Suara"
          >
            <Mic size={18} />
          </Button>

          <Input
            type="text"
            placeholder="Ketik pesan konsultasi Anda di sini... (Enter untuk kirim)"
            value={inputMessage}
            disabled={isSending}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendText();
              }
            }}
            className="flex-1 h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-teal-500"
          />

          <Button
            type="button"
            size="sm"
            disabled={!inputMessage.trim() || isSending}
            onClick={onSendText}
            className="h-9 px-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1.5 font-semibold text-xs shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Kirim</span>
                <Send size={13} />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
