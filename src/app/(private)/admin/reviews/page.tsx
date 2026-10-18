"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tables, TablePaginationFooter, Column } from "@/components/shared/atoms/Table";
import { notify } from "@/lib/toast";
import { bookingClient, BookingApiError } from "@/services/booking.client";
import type { AdminReviewItem } from "@/types/booking";
import {
  Star,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
  Calendar,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

type ModerationFilter = "all" | "reported" | "hidden";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [filter, setFilter] = useState<ModerationFilter>("reported");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modal dialog konfirmasi moderasi
  const [selectedReview, setSelectedReview] = useState<AdminReviewItem | null>(null);
  const [targetHiddenState, setTargetHiddenState] = useState<boolean>(false);

  const fetchReviews = useCallback(async (targetPage: number, targetFilter: ModerationFilter, targetLimit: number = limit) => {
    try {
      setIsLoading(true);
      const res = await bookingClient.adminGetReviews({
        filter: targetFilter === "all" ? undefined : targetFilter,
        page: targetPage,
        limit: targetLimit,
      });

      if (res.success && Array.isArray(res.data)) {
        setReviews(res.data);
        setTotal(res.pagination.total);
      } else {
        setReviews([]);
        setTotal(0);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat daftar ulasan admin:", err);
      if (err instanceof BookingApiError) {
        notify.error("Gagal Memuat Ulasan", err.message);
      } else {
        notify.error("Kesalahan Sistem", "Gagal memuat ulasan untuk moderasi");
      }
      setReviews([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchReviews(page, filter, limit);
  }, [fetchReviews, page, filter, limit]);

  const handleFilterChange = (newFilter: ModerationFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Pencarian lokal pada item yang dimuat
  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      return (
        r.nama_lengkap_gelar.toLowerCase().includes(q) ||
        r.patient_display_name.toLowerCase().includes(q) ||
        (r.review && r.review.toLowerCase().includes(q)) ||
        r.booking_id.toLowerCase().includes(q)
      );
    });
  }, [reviews, search]);

  const reportedCount = useMemo(() => {
    return reviews.filter((r) => !!r.reported_at).length;
  }, [reviews]);

  const hiddenCount = useMemo(() => {
    return reviews.filter((r) => r.is_hidden).length;
  }, [reviews]);

  const handleOpenActionModal = (review: AdminReviewItem, nextHidden: boolean) => {
    setSelectedReview(review);
    setTargetHiddenState(nextHidden);
  };

  const handleConfirmToggleHidden = async () => {
    if (!selectedReview) return;

    try {
      setIsProcessing(true);
      const res = await bookingClient.adminSetReviewHidden(selectedReview.booking_id, {
        is_hidden: targetHiddenState,
      });

      notify.success(
        targetHiddenState ? "Ulasan Disembunyikan" : "Ulasan Ditampilkan",
        res.message || (targetHiddenState ? "Ulasan tidak lagi terlihat di publik" : "Ulasan dapat dilihat kembali oleh publik")
      );

      setSelectedReview(null);
      fetchReviews(page, filter, limit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses moderasi ulasan";
      notify.error("Gagal Moderasi", msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return isoString;
      return (
        d.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      );
    } catch {
      return isoString;
    }
  };

  const columns: Column<AdminReviewItem>[] = [
    {
      label: "Sesi & Pasien",
      className: "w-[20%]",
      renderCell: (r) => (
        <div className="space-y-1">
          <p className="font-bold text-slate-900 dark:text-white text-xs">
            {r.patient_display_name}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Calendar size={12} className="shrink-0 text-slate-400" />
            <span>{r.start_at ? formatDate(r.start_at) : "-"}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[120px]" title={r.booking_id}>
            Booking: {r.booking_id.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      label: "Psikolog",
      className: "w-[20%]",
      renderCell: (r) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white text-xs">
            {r.nama_lengkap_gelar}
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            ID: {r.psikolog_id.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      label: "Rating & Teks Ulasan",
      className: "w-[30%]",
      renderCell: (r) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <div className="flex items-center text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={13}
                  className={star <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}
                />
              ))}
            </div>
            <span className="font-bold font-mono text-xs text-slate-900 dark:text-white ml-1">
              {r.rating}.0
            </span>
          </div>
          {r.review ? (
            <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
              &quot;{r.review}&quot;
            </p>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Tanpa teks ulasan</span>
          )}
        </div>
      ),
    },
    {
      label: "Status Moderasi",
      className: "w-[16%]",
      renderCell: (r) => (
        <div className="space-y-1">
          {r.reported_at ? (
            <div className="space-y-0.5">
              <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 text-[10px] font-bold">
                Dilaporkan Psikolog
              </Badge>
              <span className="text-[10px] text-slate-400 block font-mono">
                {formatDate(r.reported_at)}
              </span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 dark:border-slate-700">
              Tidak Dilaporkan
            </Badge>
          )}

          <div>
            {r.is_hidden ? (
              <Badge className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 text-[10px] font-bold">
                Disembunyikan
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                Tampil Publik
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      label: "Aksi",
      align: "center",
      className: "w-[14%]",
      renderCell: (r) => (
        <div className="flex justify-center">
          {r.is_hidden ? (
            <Button
              size="sm"
              onClick={() => handleOpenActionModal(r, false)}
              className="h-7.5 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg gap-1.5 cursor-pointer shadow-2xs"
              title="Tampilkan ulasan ini kembali ke publik"
            >
              <Eye size={13} />
              <span>Tampilkan</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenActionModal(r, true)}
              className="h-7.5 px-2.5 text-xs border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold rounded-lg gap-1.5 cursor-pointer"
              title="Sembunyikan ulasan ini dari profil publik"
            >
              <EyeOff size={13} />
              <span>Sembunyikan</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Moderasi Ulasan Sesi Konseling
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kurasi dan moderasi ulasan pasien terhadap psikolog klinis untuk menjaga kepatuhan dan integritas komunitas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReviews(page, filter, limit)}
            disabled={isLoading}
            className="text-xs rounded-xl h-9 gap-1.5 border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            <span>Segarkan Ulasan</span>
          </Button>
        </div>
      </div>

      {/* 2. Kartu Metrik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                Dilaporkan Psikolog
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {reportedCount} Ulasan
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                Membutuhkan tindakan evaluasi admin
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                Disembunyikan
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {hiddenCount} Ulasan
              </p>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                Disensor dari tampilan profil publik
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <EyeOff size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Ulasan
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {total} Ulasan
              </p>
              <p className="text-[11px] text-slate-400">Tercatat di sistem platform</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <MessageSquare size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Tabel Ulasan & Filter */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Daftar Ulasan & Tindakan Moderasi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Gunakan tombol sembunyikan untuk memblokir ulasan melanggar norma atau privasi
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Filter Tabs */}
              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleFilterChange("reported")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "reported"
                      ? "bg-amber-500 text-white shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Dilaporkan
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("hidden")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "hidden"
                      ? "bg-rose-600 text-white shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Disembunyikan
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("all")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Semua
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Cari psikolog, pasien, ulasan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-teal-600" />
              <span className="text-xs">Memuat ulasan moderasi...</span>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
              <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Tidak ada ulasan pada filter ini
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Ulasan sesi yang berstatus {filter === "all" ? "apa pun" : filter} akan ditampilkan di sini.
              </p>
            </div>
          ) : (
            <Tables<AdminReviewItem>
              columns={columns}
              data={filteredReviews}
              rowKey={(r) => r.id}
            />
          )}

          {/* Pagination Footer */}
          <TablePaginationFooter
            totalItems={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onChangeLimit={handleLimitChange}
          />
        </CardContent>
      </Card>

      {/* Dialog Konfirmasi Sembunyikan / Tampilkan */}
      <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold flex items-center gap-2">
              {targetHiddenState ? (
                <>
                  <EyeOff size={20} className="text-rose-600" />
                  <span>Sembunyikan Ulasan dari Publik</span>
                </>
              ) : (
                <>
                  <Eye size={20} className="text-emerald-600" />
                  <span>Tampilkan Kembali Ulasan ke Publik</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {targetHiddenState
                ? "Ulasan ini tidak akan dihitung dalam agregat rating publik dan tidak tampil di profil psikolog."
                : "Ulasan ini akan kembali tampil di profil psikolog dan diikutsertakan dalam kalkulasi rating rata-rata."}
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Psikolog:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedReview.nama_lengkap_gelar}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pasien:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedReview.patient_display_name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Rating:</span>
                  <span className="font-bold font-mono text-amber-600 flex items-center gap-1">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {selectedReview.rating}.0
                  </span>
                </div>
                {selectedReview.review && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block mb-1">Teks Ulasan:</span>
                    <p className="italic text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      &quot;{selectedReview.review}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedReview(null)}
              disabled={isProcessing}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>

            {targetHiddenState ? (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmToggleHidden}
                disabled={isProcessing}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Sembunyikan Ulasan</span>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmToggleHidden}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Tampilkan Ulasan</span>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
