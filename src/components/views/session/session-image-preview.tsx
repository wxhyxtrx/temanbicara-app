"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, AlertCircle, ZoomIn, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { bookingClient } from "@/services/booking.client";

interface SessionImagePreviewProps {
  bookingId: string;
  mediaPath: string;
  caption?: string | null;
  isMine?: boolean;
}

export function SessionImagePreview({
  bookingId,
  mediaPath,
  caption,
  isMine = false,
}: SessionImagePreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadImageUrl() {
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
          setUrlError(err instanceof Error ? err.message : "Gagal memuat gambar");
        }
      } finally {
        if (!isCancelled) {
          setLoadingUrl(false);
        }
      }
    }

    loadImageUrl();

    return () => {
      isCancelled = true;
    };
  }, [bookingId, mediaPath]);

  if (loadingUrl) {
    return (
      <div className="flex items-center gap-2 py-4 px-6 text-xs bg-black/5 dark:bg-white/5 rounded-xl">
        <Loader2 size={16} className="animate-spin text-teal-600" />
        <span>Memuat gambar...</span>
      </div>
    );
  }

  if (urlError || !signedUrl) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
        <AlertCircle size={14} />
        <span>Gambar tidak dapat dimuat</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-w-[280px] sm:max-w-[340px]">
      <div
        onClick={() => setIsZoomOpen(true)}
        className="relative group rounded-xl overflow-hidden border border-black/10 dark:border-white/10 cursor-pointer aspect-auto max-h-[260px] bg-black/5 dark:bg-white/5"
      >
        <img
          src={signedUrl}
          alt={caption || "Lampiran gambar sesi"}
          className="w-full h-auto max-h-[260px] object-cover transition-transform duration-200 group-hover:scale-102"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <ZoomIn size={22} className="drop-shadow-md" />
        </div>
      </div>

      {caption && (
        <p
          className={`text-xs leading-relaxed px-1 ${
            isMine ? "text-white/95" : "text-slate-800 dark:text-slate-200"
          }`}
        >
          {caption}
        </p>
      )}

      {/* Lightbox Modal */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none text-white overflow-hidden">
          <DialogTitle className="sr-only">Pratinjau Gambar</DialogTitle>
          <div className="relative flex flex-col items-center justify-center p-2">
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer z-10"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
            <img
              src={signedUrl}
              alt={caption || "Gambar Sesi"}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
            />
            {caption && (
              <p className="mt-3 text-xs sm:text-sm text-center text-white/90 max-w-lg">
                {caption}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
