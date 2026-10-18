"use client";

import { useRef, useState } from "react";
import { notify } from "@/lib/toast";

interface UseVoiceRecorderOptions {
  onRecorded: (blob: Blob, durationSeconds: number, mimeType: string) => Promise<void>;
  maxSeconds?: number;
}

export function useVoiceRecorder({ onRecorded, maxSeconds = 120 }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        notify.error("Mikrofon Tidak Didukung", "Peramban ini tidak mendukung perekaman audio.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= maxSeconds) {
            stopRecording();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      notify.error("Izin Mikrofon Ditolak", "Mohon berikan izin akses mikrofon untuk merekam suara.");
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
    audioChunksRef.current = [];
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerRef.current) clearInterval(timerRef.current);
    const duration = Math.max(1, recordSeconds);
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          notify.error("Rekaman Kosong", "Tidak ada suara yang terekam.");
          return;
        }

        await onRecorded(audioBlob, duration, mimeType);
      } catch (err: unknown) {
        notify.error("Gagal Mengirim Pesan Suara", err instanceof Error ? err.message : "Kesalahan sistem.");
      } finally {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
        setRecordSeconds(0);
        audioChunksRef.current = [];
      }
    };

    recorder.stop();
  };

  return {
    isRecording,
    recordSeconds,
    startRecording,
    cancelRecording,
    stopRecording,
  };
}
