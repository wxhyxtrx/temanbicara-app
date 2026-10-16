"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tables, TablePagination, TableInfo, Column } from "@/components/shared/atoms/Table";
import { walletClient, WalletApiError } from "@/services/wallet.client";
import { openSnapModal } from "@/lib/snap";
import { notify } from "@/lib/toast";
import type {
  LedgerEntryEntity,
  PaginationMeta,
  PaymentStatus,
  TopupOrderEntity,
  WalletInfoResponse,
} from "@/types/wallet";
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowLeft,
  PlusCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  XCircle,
  RefreshCw,
} from "lucide-react";

function getReasonMetadata(reason: string): { label: string; description: string; isCredit: boolean } {
  switch (reason) {
    case "topup_settled":
      return {
        label: "Top-Up Koin Berhasil",
        description: "Pengisian koin via Midtrans Snap",
        isCredit: true,
      };
    case "tip_debit":
      return {
        label: "Pemberian Tip Apresiasi",
        description: "Apresiasi koin kepada konselor/pendengar",
        isCredit: false,
      };
    case "tip_pending":
      return {
        label: "Tip Diterima (Tertahan)",
        description: "Honor tip masuk masa holding 48 jam",
        isCredit: true,
      };
    case "holding_release_available":
      return {
        label: "Pelepasan Saldo Holding",
        description: "Dana holding beralih ke saldo siap ditarik",
        isCredit: true,
      };
    case "holding_release_pending":
      return {
        label: "Holding Selesai",
        description: "Pelepasan saldo masa holding 48 jam",
        isCredit: false,
      };
    case "payout_reserved":
      return {
        label: "Pengajuan Penarikan Saldo",
        description: "Reservasi penarikan dana ke rekening bank",
        isCredit: false,
      };
    case "payout_rejected_refund":
      return {
        label: "Pengembalian Dana Payout",
        description: "Saldo dikembalikan karena penarikan ditolak",
        isCredit: true,
      };
    case "payout_paid":
      return {
        label: "Pencairan Dana Berhasil",
        description: "Transfer honor ke rekening bank selesai",
        isCredit: false,
      };
    case "payout_fee":
      return {
        label: "Biaya Transfer Bank",
        description: "Biaya administrasi pencairan payout",
        isCredit: false,
      };
    default:
      return {
        label: reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "Mutasi buku besar akun",
        isCredit: false,
      };
  }
}

function isPastExpiry(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  return !isNaN(exp) && now >= exp;
}

function isCreatedWithin24Hours(createdAt: string, now: number): boolean {
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  return now - createdTime < 24 * 60 * 60 * 1000;
}

function formatRemainingTime(expiresAt: string | null | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  if (isNaN(exp)) return null;
  const diffSec = Math.floor((exp - now) / 1000);
  if (diffSec <= 0) return null;
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function renderTopupStatusBadge(status: PaymentStatus) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[10px] font-bold gap-1">
          <Clock size={11} className="animate-pulse" />
          <span>Menunggu</span>
        </Badge>
      );
    case "settlement":
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[10px] font-bold gap-1">
          <CheckCircle2 size={11} />
          <span>Berhasil</span>
        </Badge>
      );
    case "expire":
      return (
        <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 text-[10px] font-bold gap-1">
          <Clock size={11} />
          <span>Kedaluwarsa</span>
        </Badge>
      );
    case "deny":
      return (
        <Badge className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 text-[10px] font-bold gap-1">
          <XCircle size={11} />
          <span>Gagal</span>
        </Badge>
      );
    case "cancel":
    case "refund":
    default:
      return (
        <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 text-[10px] font-bold gap-1">
          <span>Dibatalkan</span>
        </Badge>
      );
  }
}

export default function PatientTransactionHistoryPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletInfoResponse | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState<boolean>(true);

  // Top-Up History State
  const [topups, setTopups] = useState<TopupOrderEntity[]>([]);
  const [topupMeta, setTopupMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [topupPage, setTopupPage] = useState<number>(1);
  const [topupLimit, setTopupLimit] = useState<number>(10);
  const [isLoadingTopups, setIsLoadingTopups] = useState<boolean>(true);
  const [topupStatusFilter, setTopupStatusFilter] = useState<"all" | "pending" | "settlement" | "expire" | "fail">("all");
  const [topupSearchQuery, setTopupSearchQuery] = useState<string>("");
  const [isOpeningSnap, setIsOpeningSnap] = useState<boolean>(false);

  // Status Reconciliation State & Guards
  const [checkingOrderIds, setCheckingOrderIds] = useState<Record<string, boolean>>({});
  const autoCheckedOrderIdsRef = React.useRef<Set<string>>(new Set());
  const inFlightOrderIdsRef = React.useRef<Set<string>>(new Set());
  const lastCheckedAtRef = React.useRef<Record<string, number>>({});

  // Mutation Ledger State
  const [transactions, setTransactions] = useState<LedgerEntryEntity[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<LedgerEntryEntity | null>(null);

  // Live ticking timer for real-time countdown
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTopups = useCallback(async (targetPage: number, targetLimit: number) => {
    try {
      setIsLoadingTopups(true);
      const res = await walletClient.getTopups({ page: targetPage, limit: targetLimit });
      setTopups(res.items);
      setTopupMeta(res.meta);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat riwayat top-up:", err);
    } finally {
      setIsLoadingTopups(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (targetPage: number, targetLimit: number) => {
    try {
      setIsLoading(true);
      const res = await walletClient.getTransactions({ page: targetPage, limit: targetLimit });
      setTransactions(res.items);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat mutasi transaksi:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTopupLimitChange = useCallback((newLimit: number) => {
    setTopupLimit(newLimit);
    setTopupPage(1);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      setIsLoadingWallet(true);
      const data = await walletClient.getWalletMe();
      setWallet(data);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat saldo dompet:", err);
    } finally {
      setIsLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchWallet();
    fetchTransactions(page, limit);
    fetchTopups(topupPage, topupLimit);

    const handleRefresh = () => {
      fetchWallet();
      fetchTransactions(page, limit);
      fetchTopups(topupPage, topupLimit);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wallet:refresh", handleRefresh);
      return () => {
        window.removeEventListener("wallet:refresh", handleRefresh);
      };
    }
  }, [fetchWallet, fetchTransactions, fetchTopups, page, limit, topupPage, topupLimit]);

  // Cek Status Pembayaran ke Midtrans via Server Rekonsiliasi
  const handleCheckStatus = useCallback(
    async (orderId: string, isAuto = false) => {
      if (inFlightOrderIdsRef.current.has(orderId)) return;

      if (!isAuto) {
        const lastCheck = lastCheckedAtRef.current[orderId] || 0;
        if (Date.now() - lastCheck < 10000) {
          notify.info(
            "Mohon Tunggu",
            "Pengecekan status dibatasi maksimal 1 kali per 10 detik. Silakan coba sesaat lagi."
          );
          return;
        }
      }

      inFlightOrderIdsRef.current.add(orderId);
      if (isAuto) {
        autoCheckedOrderIdsRef.current.add(orderId);
      }
      lastCheckedAtRef.current[orderId] = Date.now();
      setCheckingOrderIds((prev) => ({ ...prev, [orderId]: true }));

      try {
        const updatedOrder = await walletClient.checkTopupStatus(orderId);

        setTopups((prev) =>
          prev.map((item) => (item.order_id === orderId ? { ...item, ...updatedOrder } : item))
        );

        if (updatedOrder.status === "settlement") {
          notify.success(
            "Top-Up Koin Berhasil!",
            `Pembayaran ${updatedOrder.coins} koin telah diverifikasi. Saldo telah ditambahkan.`
          );
          fetchWallet();
          fetchTransactions(page, limit);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wallet:refresh"));
          }
        } else if (!isAuto) {
          if (updatedOrder.status === "expire") {
            notify.info("Status Pesanan", "Status transaksi di Midtrans: kedaluwarsa.");
          } else if (updatedOrder.status === "pending") {
            notify.info("Status Pesanan", "Pesanan masih menunggu pembayaran di Midtrans.");
          } else {
            notify.info("Status Pesanan", `Status transaksi di Midtrans: ${updatedOrder.status}.`);
          }
        }
      } catch (err) {
        if (err instanceof WalletApiError && err.handled) return;
        console.error("Gagal memeriksa status pesanan:", err);
        if (!isAuto) {
          notify.error("Gagal Cek Status", "Tidak dapat memeriksa status pesanan saat ini.");
        }
      } finally {
        inFlightOrderIdsRef.current.delete(orderId);
        setCheckingOrderIds((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }
    },
    [fetchWallet, fetchTransactions, page]
  );

  // Auto-check SEKALI untuk order pending yang sudah lewat batas waktu (expires_at)
  useEffect(() => {
    topups.forEach((order) => {
      if (
        order.status === "pending" &&
        isPastExpiry(order.expires_at, currentTime) &&
        !autoCheckedOrderIdsRef.current.has(order.order_id) &&
        !inFlightOrderIdsRef.current.has(order.order_id)
      ) {
        handleCheckStatus(order.order_id, true);
      }
    });
  }, [topups, currentTime, handleCheckStatus]);

  // Handle Lanjutkan Pembayaran (buka Snap lagi)
  const handleContinuePayment = async (order: TopupOrderEntity) => {
    if (!order.snap_redirect_url) return;
    setIsOpeningSnap(true);
    try {
      const url = new URL(order.snap_redirect_url);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const token = pathParts[pathParts.length - 1];

      if (token) {
        await openSnapModal(token, {
          onSuccess: () => {
            notify.success("Top-Up Berhasil", "Pembayaran koin Anda telah diverifikasi.");
            fetchTopups(topupPage, topupLimit);
            fetchWallet();
            fetchTransactions(page, limit);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("wallet:refresh"));
            }
          },
          onPending: () => {
            notify.info("Menunggu Pembayaran", "Silakan selesaikan pembayaran di Midtrans.");
            fetchTopups(topupPage, topupLimit);
          },
          onError: () => {
            notify.error("Pembayaran Gagal", "Transaksi tidak dapat diselesaikan.");
            fetchTopups(topupPage, topupLimit);
          },
          onClose: () => {
            fetchTopups(topupPage, topupLimit);
            fetchWallet();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("wallet:refresh"));
            }
          },
        });
        return;
      }
    } catch (err) {
      console.error("Gagal membuka Snap modal, mengalihkan ke URL pembayaran:", err);
    } finally {
      setIsOpeningSnap(false);
    }

    // Fallback ke redirect URL langsung
    window.location.href = order.snap_redirect_url;
  };

  // Filtered Topup List
  const filteredTopups = useMemo(() => {
    return topups.filter((order) => {
      const matchStatus =
        topupStatusFilter === "all" ||
        (topupStatusFilter === "pending" && order.status === "pending") ||
        (topupStatusFilter === "settlement" && order.status === "settlement") ||
        (topupStatusFilter === "expire" && order.status === "expire") ||
        (topupStatusFilter === "fail" &&
          (order.status === "deny" || order.status === "cancel" || order.status === "refund"));

      const q = topupSearchQuery.toLowerCase();
      const matchQuery =
        !q ||
        order.order_id.toLowerCase().includes(q) ||
        (order.provider_reference && order.provider_reference.toLowerCase().includes(q)) ||
        String(order.coins).includes(q) ||
        String(order.amount_rupiah).includes(q);

      return matchStatus && matchQuery;
    });
  }, [topups, topupStatusFilter, topupSearchQuery]);

  // Aggregate Topup Metrics
  const topupSettledCoins = useMemo(
    () =>
      topups
        .filter((t) => t.status === "settlement")
        .reduce((acc, curr) => acc + curr.coins, 0),
    [topups]
  );

  const topupPendingCount = useMemo(
    () => topups.filter((t) => t.status === "pending").length,
    [topups]
  );

  // Filtered Ledger List
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      const isPositive = tx.amount > 0;
      const matchType =
        filterType === "all" ||
        (filterType === "in" && isPositive) ||
        (filterType === "out" && !isPositive);

      const meta = getReasonMetadata(tx.reason);
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        tx.reason.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        (tx.ref_id && tx.ref_id.toLowerCase().includes(q));

      return matchType && matchQuery;
    });
  }, [transactions, filterType, searchQuery]);

  // Aggregate Ledger Metrics
  const totalCoinsIn = useMemo(
    () =>
      transactions
        .filter((t) => t.unit === "coin" && t.amount > 0)
        .reduce((acc, curr) => acc + curr.amount, 0),
    [transactions]
  );

  const totalCoinsOut = useMemo(
    () =>
      transactions
        .filter((t) => t.unit === "coin" && t.amount < 0)
        .reduce((acc, curr) => acc + Math.abs(curr.amount), 0),
    [transactions]
  );

  // Columns for Top-Up History Table
  const topupColumns: Column<TopupOrderEntity>[] = [
    {
      label: "Waktu & ID Pesanan",
      className: "w-[28%]",
      renderCell: (order) => {
        const dateStr = new Date(order.created_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-white text-xs">{dateStr} WIB</p>
            <span
              className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate max-w-[180px]"
              title={order.order_id}
            >
              {order.order_id}
            </span>
          </div>
        );
      },
    },
    {
      label: "Nominal & Koin",
      align: "right",
      className: "w-[22%]",
      renderCell: (order) => {
        return (
          <div className="text-right space-y-0.5">
            <p className="font-mono font-bold text-xs sm:text-sm text-emerald-700 dark:text-emerald-400">
              {order.coins > 0 ? `+${order.coins}` : "0"} Koin
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Rp {order.amount_rupiah.toLocaleString("id-ID")}
            </p>
          </div>
        );
      },
    },
    {
      label: "Status & Batas Waktu",
      className: "w-[26%]",
      renderCell: (order) => {
        const isPastExp = isPastExpiry(order.expires_at, currentTime);
        const isPending = order.status === "pending";
        const remaining = isPending && !isPastExp ? formatRemainingTime(order.expires_at, currentTime) : null;

        return (
          <div className="space-y-1">
            <div>
              {isPending && isPastExp ? (
                <Badge className="bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 text-[10px] font-bold gap-1">
                  <Loader2 size={11} className="animate-spin" />
                  <span>Memeriksa pembayaran…</span>
                </Badge>
              ) : (
                renderTopupStatusBadge(order.status)
              )}
            </div>
            {isPending && remaining && (
              <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Clock size={11} className="shrink-0" />
                <span>Sisa {remaining}</span>
              </span>
            )}
            {order.status === "settlement" && order.settled_at && (
              <span className="text-[10px] text-slate-400 block font-mono">
                {new Date(order.settled_at).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </span>
            )}
          </div>
        );
      },
    },
    {
      label: "Aksi",
      align: "center",
      className: "w-[24%]",
      renderCell: (order) => {
        const isPastExp = isPastExpiry(order.expires_at, currentTime);
        const isPending = order.status === "pending";
        const isChecking = Boolean(checkingOrderIds[order.order_id]);
        const canContinue = isPending && !isPastExp && Boolean(order.snap_redirect_url);
        const isRecentExpire =
          order.status === "expire" && isCreatedWithin24Hours(order.created_at, currentTime);

        if (canContinue) {
          return (
            <div className="flex justify-center">
              <Button
                size="sm"
                onClick={() => handleContinuePayment(order)}
                disabled={isOpeningSnap}
                className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3 font-semibold gap-1.5 shadow-2xs cursor-pointer"
                title="Lanjutkan Pembayaran via Midtrans Snap"
              >
                <CreditCard size={13} />
                <span>Lanjutkan Pembayaran</span>
              </Button>
            </div>
          );
        }

        if (isRecentExpire) {
          return (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCheckStatus(order.order_id, false)}
                disabled={isChecking}
                className="h-8 text-xs border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-xl px-3 font-semibold gap-1.5 shadow-2xs cursor-pointer"
                title="Cek Status Pembayaran ke Midtrans"
              >
                {isChecking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span>Cek Status</span>
              </Button>
            </div>
          );
        }

        return <span className="text-slate-400 text-xs">-</span>;
      },
    },
  ];

  // Columns for Ledger Mutation Table
  const columns: Column<LedgerEntryEntity>[] = [
    {
      label: "Waktu & ID Transaksi",
      className: "w-[24%]",
      renderCell: (tx) => {
        const dateStr = new Date(tx.created_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-white text-xs">{dateStr} WIB</p>
            <span
              className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate max-w-[140px]"
              title={tx.id}
            >
              ID: {tx.id.slice(0, 8)}...
            </span>
          </div>
        );
      },
    },
    {
      label: "Aktivitas / Alasan",
      className: "w-[30%]",
      renderCell: (tx) => {
        const meta = getReasonMetadata(tx.reason);
        return (
          <div>
            <p className="font-bold text-slate-900 dark:text-white font-heading text-xs">{meta.label}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">{meta.description}</p>
          </div>
        );
      },
    },
    {
      label: "Akun Buku Besar",
      className: "w-[18%]",
      renderCell: (tx) => (
        <div>
          <Badge variant="outline" className="text-[10px] font-mono capitalize">
            {tx.account.replace(/_/g, " ")}
          </Badge>
          <span className="text-[10px] text-slate-400 block mt-0.5 capitalize">
            Ref: {tx.ref_type}
          </span>
        </div>
      ),
    },
    {
      label: "Nominal Perubahan",
      align: "right",
      className: "w-[18%]",
      renderCell: (tx) => {
        const isPlus = tx.amount > 0;
        const isMinus = tx.amount < 0;
        const isCoin = tx.unit === "coin";
        const formattedAmount = isPlus
          ? `+${tx.amount}`
          : isMinus
          ? `${tx.amount}`
          : "0";
        return (
          <div className="text-right">
            <span
              className={`font-mono font-bold text-xs sm:text-sm ${
                isPlus
                  ? "text-emerald-700 dark:text-emerald-400"
                  : isMinus
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {formattedAmount} {isCoin ? "Koin" : "Rp"}
            </span>
            {!isCoin && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Rp {Math.abs(tx.amount).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        );
      },
    },
    {
      label: "Detail",
      align: "center",
      className: "w-[10%]",
      renderCell: (tx) => (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTx(tx)}
            className="h-8 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2.5 gap-1 font-semibold cursor-pointer"
            title="Lihat Rincian Mutasi"
          >
            <Eye size={13} />
            <span>Lihat</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/patient/top-up">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Kembali ke Halaman Top Up"
              >
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Riwayat Top-Up & Mutasi Dompet
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Catatan riwayat transaksi top-up koin dan buku besar mutasi akun TemanBicara
          </p>
        </div>

        {/* Current Balance Pill & Top Up CTA */}
        <div className="flex items-center gap-2.5">
          <div className="h-10 px-4 rounded-xl flex items-center gap-2.5 bg-teal-50 dark:bg-teal-950/70 border border-teal-200/90 dark:border-teal-800 text-teal-900 dark:text-teal-200 shadow-2xs">
            <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Coins size={13} />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold leading-none uppercase tracking-wider">
                Saldo Pasien
              </span>
              <span className="text-xs sm:text-sm font-bold font-heading leading-tight truncate">
                {!mounted || isLoadingWallet || wallet === null ? (
                  <Skeleton className="h-3.5 w-14 rounded mt-0.5" />
                ) : (
                  `${wallet.coin_balance} Koin`
                )}
              </span>
            </div>
          </div>

          <Link href="/patient/top-up">
            <Button className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold gap-1.5 shadow-sm shadow-teal-700/20 cursor-pointer">
              <PlusCircle size={15} />
              <span>Top Up Koin</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Main Tabs View */}
      <Tabs defaultValue="topup" className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="topup"
              className="rounded-lg px-4 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 gap-2 cursor-pointer"
            >
              <CreditCard size={15} />
              <span>Riwayat Top-Up</span>
              {topupMeta.total > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-mono">
                  {topupMeta.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="mutasi"
              className="rounded-lg px-4 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 gap-2 cursor-pointer"
            >
              <FileText size={15} />
              <span>Mutasi Koin</span>
              {meta.total > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
                  {meta.total}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== TAB 1: RIWAYAT TOP-UP ==================== */}
        <TabsContent value="topup" className="space-y-6 mt-0">
          {/* Topup Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Koin dari Top-Up Berhasil
                  </span>
                  {!mounted || isLoadingTopups ? (
                    <Skeleton className="h-7 w-24 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-emerald-600 dark:text-emerald-400 font-mono">
                      {topupSettledCoins > 0 ? `+${topupSettledCoins}` : "0"} Koin
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Akumulasi halaman ini</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Menunggu Pembayaran
                  </span>
                  {!mounted || isLoadingTopups ? (
                    <Skeleton className="h-7 w-28 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-amber-600 dark:text-amber-400 font-mono">
                      {topupPendingCount} Pesanan
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Selesaikan sebelum batas waktu</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Total Pesanan Top-Up
                  </span>
                  {!mounted || isLoadingTopups ? (
                    <Skeleton className="h-7 w-28 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-teal-800 dark:text-teal-300 font-mono">
                      {topupMeta.total} Pesanan
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Buku transaksi Midtrans</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <CreditCard size={20} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Topup Table Card */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Riwayat Top-Up
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Semua pembelian koin, termasuk yang menunggu atau gagal.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Status Filter Buttons */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTopupStatusFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        topupStatusFilter === "all"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopupStatusFilter("pending")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        topupStatusFilter === "pending"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Menunggu
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopupStatusFilter("settlement")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        topupStatusFilter === "settlement"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Berhasil
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopupStatusFilter("expire")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        topupStatusFilter === "expire"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Kedaluwarsa
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopupStatusFilter("fail")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        topupStatusFilter === "fail"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Gagal / Batal
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative flex-1 sm:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Cari ID pesanan..."
                      value={topupSearchQuery}
                      onChange={(e) => setTopupSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingTopups ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-teal-600" />
                  <span className="text-xs">Memuat riwayat top-up...</span>
                </div>
              ) : filteredTopups.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
                  <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Belum ada riwayat pesanan top-up
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Pesanan pengisian koin yang Anda lakukan akan tercatat di sini.
                  </p>
                </div>
              ) : (
                <Tables<TopupOrderEntity>
                  columns={topupColumns}
                  data={filteredTopups}
                  rowKey={(order) => order.id}
                />
              )}

              {/* Pagination Footer */}
              {topupMeta.total > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                  <TableInfo
                    total={topupMeta.total}
                    displayed={topupLimit}
                    onChangeDisplayed={handleTopupLimitChange}
                    list={[10, 20, 50]}
                  />
                  <TablePagination
                    totalItems={topupMeta.total}
                    page={topupPage}
                    limit={topupLimit}
                    onPageChange={(p) => setTopupPage(p)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 2: MUTASI KOIN ==================== */}
        <TabsContent value="mutasi" className="space-y-6 mt-0">
          {/* Mutation Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Total Koin Masuk (Halaman Ini)
                  </span>
                  {!mounted || isLoading ? (
                    <Skeleton className="h-7 w-24 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-emerald-600 dark:text-emerald-400 font-mono">
                      {totalCoinsIn > 0 ? `+${totalCoinsIn}` : "0"} Koin
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Top-up yang telah diverifikasi</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center shrink-0">
                  <ArrowDownLeft size={20} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Total Koin Terpakai (Halaman Ini)
                  </span>
                  {!mounted || isLoading ? (
                    <Skeleton className="h-7 w-24 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-rose-600 dark:text-rose-400 font-mono">
                      {totalCoinsOut > 0 ? `-${totalCoinsOut}` : "0"} Koin
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Penggunaan sesi & apresiasi tip</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={20} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Total Transaksi Tercatat
                  </span>
                  {!mounted || isLoading ? (
                    <Skeleton className="h-7 w-28 rounded my-0.5" />
                  ) : (
                    <span className="text-lg sm:text-xl font-bold font-heading text-teal-800 dark:text-teal-300 font-mono">
                      {meta.total} Entri
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 block">Buku besar append-only</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mutation Table Card */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Mutasi Koin
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Semua koin masuk dan keluar dari saldomu.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Type Filter Buttons */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        filterType === "all"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("in")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        filterType === "in"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Koin Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("out")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        filterType === "out"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Koin Keluar
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative flex-1 sm:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Cari transaksi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
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
                  <span className="text-xs">Memuat data mutasi buku besar...</span>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
                  <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Belum ada catatan mutasi transaksi
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Riwayat top-up dan penggunaan koin konsultasi Anda akan muncul di sini.
                  </p>
                </div>
              ) : (
                <Tables<LedgerEntryEntity>
                  columns={columns}
                  data={filteredList}
                  rowKey={(tx) => tx.id}
                />
              )}

              {/* Pagination Footer */}
              {meta.total > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                  <TableInfo
                    total={meta.total}
                    displayed={limit}
                    onChangeDisplayed={handleLimitChange}
                    list={[10, 20, 50]}
                  />
                  <TablePagination
                    totalItems={meta.total}
                    page={page}
                    limit={limit}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 4. Modal Detail Mutasi Ledger */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={18} className="text-teal-600" />
              <span>Rincian Mutasi Buku Besar</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              ID Entri: {selectedTx?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-xs font-nunito">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Aktivitas:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {getReasonMetadata(selectedTx.reason).label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Akun Ledger:</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedTx.account}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Nominal:</span>
                  <span
                    className={`font-bold font-mono text-sm ${
                      selectedTx.amount > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : selectedTx.amount < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {selectedTx.amount > 0
                      ? `+${selectedTx.amount}`
                      : selectedTx.amount < 0
                      ? `${selectedTx.amount}`
                      : "0"}{" "}
                    {selectedTx.unit === "coin" ? "Koin" : "Rupiah"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tipe Referensi:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedTx.ref_type} ({selectedTx.ref_id.slice(0, 8)}...)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Waktu Pencatatan:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">
                    {new Date(selectedTx.created_at).toLocaleString("id-ID")} WIB
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800 flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <ShieldCheck size={16} className="text-teal-600 shrink-0" />
                <span className="text-[11px] leading-snug">
                  Entri ini bersifat append-only dan tidak dapat diubah demi kepatuhan audit keuangan.
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              size="sm"
              onClick={() => setSelectedTx(null)}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl cursor-pointer"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
