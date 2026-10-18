"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, AlertCircle, Loader2 } from "lucide-react";
import { bookingClient } from "@/services/booking.client";

interface SessionAudioPlayerProps {
  bookingId: string;
  mediaPath: string;
  durationSeconds?: number | null;
  isMine?: boolean;
}

export function SessionAudioPlayer({
  bookingId,
  mediaPath,
  durationSeconds,
  isMine = false,
}: SessionAudioPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(durationSeconds || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadAudioUrl() {
      if (!mediaPath) return;
      try {
        setLoadingUrl(true);
        setUrlError(null);
        const res = await bookingClient.getSessionMediaDownloadUrl(bookingId, mediaPath);
        if (!isCancelled && res?.data?.signed_url) {
          setSignedUrl(res.data.signed_url);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setUrlError(err instanceof Error ? err.message : "Gagal memuat pesan suara");
        }
      } finally {
        if (!isCancelled) {
          setLoadingUrl(false);
        }
      }
    }

    loadAudioUrl();

    return () => {
      isCancelled = true;
    };
  }, [bookingId, mediaPath]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  };

  if (loadingUrl) {
    return (
      <div className="flex items-center gap-2 py-1 px-2 text-xs opacity-75">
        <Loader2 size={14} className="animate-spin" />
        <span>Memuat audio...</span>
      </div>
    );
  }

  if (urlError) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-rose-500">
        <AlertCircle size={14} />
        <span>Gagal memutar audio</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px] sm:min-w-[240px] max-w-full">
      {signedUrl && (
        <audio
          ref={audioRef}
          src={signedUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      <button
        type="button"
        onClick={togglePlay}
        disabled={!signedUrl}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
          isMine
            ? "bg-white text-teal-700 hover:bg-slate-100 shadow-xs"
            : "bg-teal-600 text-white hover:bg-teal-700 shadow-xs"
        }`}
        aria-label={isPlaying ? "Jeda rekaman suara" : "Putar rekaman suara"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1">
        <input
          type="range"
          min={0}
          max={audioDuration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
            isMine
              ? "bg-teal-700/50 accent-white"
              : "bg-slate-200 dark:bg-slate-700 accent-teal-600"
          }`}
        />
        <div className="flex items-center justify-between text-[10px] opacity-80 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Volume2 size={10} />
            <span>{formatSeconds(audioDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
