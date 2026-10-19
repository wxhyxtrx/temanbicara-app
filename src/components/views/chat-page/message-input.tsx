"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Sparkles,
  Paperclip,
  Smile,
  Mic,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { useChatStore, Attachment } from "@/store/chat-store";

export function MessageInput() {
  const [newMessage, setNewMessage] = useState("");
  const { sendRichMessage, selectedConversation } = useChatStore();

  // Attachment state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    name: string;
    size: string;
    type: "image" | "document";
    previewUrl: string;
  } | null>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer saat merekam suara
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const sizeInKb = (file.size / 1024).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeInKb} KB`;
    const previewUrl = URL.createObjectURL(file);

    setSelectedFile({
      file,
      name: file.name,
      size: sizeStr,
      type: isImage ? "image" : "document",
      previewUrl,
    });

    // Reset input file value
    e.target.value = "";
  };

  const removeAttachment = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    setSelectedFile(null);
  };

  // Start Voice Note Recording
  const startRecording = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } else {
        // Fallback simulation mode
        setIsRecording(true);
      }
    } catch {
      // Permission rejected; fallback to simulated voice note
      setIsRecording(true);
    }
  };

  // Cancel Voice Note
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // Send Voice Note
  const sendVoiceNote = () => {
    const durationStr = `${Math.floor(recordSeconds / 60)}:${(recordSeconds % 60).toString().padStart(2, "0")}`;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        sendRichMessage({
          content: "🎙️ [Voice Note Curhat Pasien]",
          audioUrl,
          audioDuration: durationStr === "0:00" ? "0:05" : durationStr,
        });
      };
      mediaRecorderRef.current.stop();
    } else {
      // Simulation mode
      sendRichMessage({
        content: "🎙️ [Voice Note Curhat Pasien]",
        audioUrl: "/audio/mock-voice.mp3",
        audioDuration: durationStr === "0:00" ? "0:12" : durationStr,
      });
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : newMessage;
    if (!text.trim() && !selectedFile) return;

    let attachmentPayload: Attachment | undefined = undefined;
    if (selectedFile) {
      attachmentPayload = {
        name: selectedFile.name,
        url: selectedFile.previewUrl,
        type: selectedFile.type,
        size: selectedFile.size,
      };
    }

    sendRichMessage({
      content: text.trim(),
      attachment: attachmentPayload,
    });

    setNewMessage("");
    setSelectedFile(null);
  };

  const quickPrompts = [
    "Aku sedang merasa cemas berlebih",
    "Bantu aku latihan grounding 5-4-3-2-1",
    "Pikiranku terasa sangat bising hari ini",
    "Aku butuh ruang meluapkan emosi",
  ];

  return (
    <div className="p-2.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 space-y-2.5 transition-colors duration-200">
      {/* 1. Quick Therapeutic Prompt Chips (Especially active for AI) */}
      {selectedConversation?.isAI && !isRecording && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] select-none">
          <span className="text-teal-700 dark:text-teal-400 font-bold shrink-0 flex items-center gap-1 pl-1">
            <Sparkles size={12} className="text-teal-600 dark:text-teal-400" />
            Topik Cepat:
          </span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-teal-50/70 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100/70 dark:hover:bg-teal-900/60 hover:border-teal-300 dark:hover:border-teal-700 transition-colors shrink-0 cursor-pointer font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* 2. File Attachment Preview Chip */}
      {selectedFile && !isRecording && (
        <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile.type === "image" ? (
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-teal-300 dark:border-teal-700 shrink-0">
                <img src={selectedFile.previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                <FileText size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-teal-700 dark:text-teal-400">{selectedFile.size} • Berkas Rekam Medis</p>
            </div>
          </div>

          <button
            type="button"
            onClick={removeAttachment}
            className="p-1 rounded-md text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900 cursor-pointer"
            title="Hapus lampiran"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. Input Bar OR Recording Bar */}
      {isRecording ? (
        /* Voice Recorder Active Bar */
        <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-900 dark:text-rose-100">Merekam Curhat...</span>
              <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {/* Animated sound wave */}
            <div className="hidden sm:flex items-center gap-1">
              {[4, 8, 14, 6, 12, 16, 8, 14, 6].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}px` }}
                  className="w-1 bg-rose-500 rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelRecording}
              className="text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl h-8 px-2.5 gap-1 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Batal</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={sendVoiceNote}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-8 px-3.5 gap-1.5 font-semibold cursor-pointer shadow-xs"
            >
              <Send size={13} />
              <span>Kirim VN</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Standard Message Bar with Attachment & Mic */
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
          />

          {/* Paperclip Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50/70 dark:hover:bg-slate-800 hover:border-teal-200 dark:hover:border-teal-700 transition-colors shrink-0 cursor-pointer"
            title="Unggah Lampiran / Rekam Medis (PDF, DOC, Gambar)"
          >
            <Paperclip size={17} />
          </button>

          {/* Mic Button (Voice Note) */}
          <button
            type="button"
            onClick={startRecording}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 hover:border-rose-200 dark:hover:border-rose-800 transition-colors shrink-0 cursor-pointer"
            title="Rekam Voice Note Curhat"
          >
            <Mic size={17} />
          </button>

          {/* Text Input */}
          <div className="relative flex-1">
            <Input
              placeholder="Tulis apa yang kamu rasakan tanpa ragu..."
              className="pr-10 h-10 text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
              title="Emoji relaksasi"
              onClick={() => setNewMessage((prev) => prev + " 🌿")}
            >
              <Smile size={16} />
            </button>
          </div>

          {/* Send Button */}
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shrink-0 cursor-pointer shadow-xs"
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() && !selectedFile}
            aria-label="Kirim pesan"
          >
            <Send size={16} />
          </Button>
        </div>
      )}

      <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-nunito">
        Percakapan privat & rahasia. Tekan Enter untuk mengirim.
      </p>
    </div>
  );
}
