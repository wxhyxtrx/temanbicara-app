"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  /** Nama jamak untuk pesan batas, mis. "bidang spesialisasi". */
  itemName: string;
  suggestions?: string[];
  suggestionsLabel?: string;
  placeholder?: string;
  emptyText?: string;
  error?: string;
  className?: string;
}

/** Input daftar tag: tag terpilih, kolom tambah, dan saran yang bisa diklik. */
export function TagInput({
  label,
  value,
  onChange,
  max = 10,
  itemName,
  suggestions = [],
  suggestionsLabel = "Saran:",
  placeholder = "Ketik lalu tekan Tambah",
  emptyText = "Belum ada yang dipilih",
  error,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    if (value.length >= max) {
      notify.error("Batas Maksimal", `Maksimal ${max} ${itemName}.`);
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label} ({value.length}/{max})
      </Label>

      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
        {value.length === 0 ? (
          <span className="text-xs text-slate-400 italic">{emptyText}</span>
        ) : (
          value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-semibold"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Hapus ${tag}`}
                title="Hapus"
                className="inline-flex p-2.5 -my-2.5 -mr-2.5 rounded-md hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => add(draft)} className="h-8 text-xs rounded-xl shrink-0 gap-1">
          <Plus size={13} />
          Tambah
        </Button>
      </div>

      {remaining.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[11px] text-slate-400 block font-nunito">{suggestionsLabel}</span>
          <div className="flex flex-wrap gap-1">
            {remaining.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => add(sug)}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{error}</p>}
    </div>
  );
}
