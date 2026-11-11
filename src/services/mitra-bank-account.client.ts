"use client";

import { useState, useEffect, useCallback } from "react";
import { POPULAR_BANKS, type PopularBank } from "@/constant/banks";
import { notify } from "@/lib/toast";

export interface MitraBankAccount {
  bank_name: string;
  account_number: string;
  bank_account_name: string;
  updated_at: string;
}

export interface SaveMitraBankAccountPayload {
  bank_name: string;
  account_number: string;
  bank_account_name: string;
}

export interface MitraBankAccountApiResponse {
  success: boolean;
  data?: {
    account: MitraBankAccount | null;
  };
  error?: string;
  message?: string;
}

export const MITRA_BANK_VERIFICATION_NOTE =
  "Rekening belum diverifikasi otomatis. Admin memeriksa nama pemilik saat pencairan.";

export class MitraBankAccountApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "MitraBankAccountApiError";
    this.status = status;
    this.code = code;
  }
}

export function maskAccountNumber(acc: string): string {
  const clean = acc.trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  const maskedLength = Math.max(clean.length - 4, 6);
  return "•".repeat(maskedLength) + last4;
}

export const mitraBankAccountClient = {
  async getBankAccount(): Promise<MitraBankAccount | null> {
    const res = await fetch("/api/mitra/bank-account", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    const json = (await res.json().catch(() => null)) as MitraBankAccountApiResponse | null;

    if (!res.ok || !json?.success) {
      const msg = json?.message || json?.error || `HTTP ${res.status}: Gagal memuat data rekening`;
      throw new MitraBankAccountApiError(res.status, msg, json?.error);
    }

    return json.data?.account ?? null;
  },

  async saveBankAccount(payload: SaveMitraBankAccountPayload): Promise<MitraBankAccount> {
    const res = await fetch("/api/mitra/bank-account", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as {
      success: boolean;
      data?: { account: MitraBankAccount };
      error?: string;
      message?: string;
    } | null;

    if (!res.ok || !json?.success || !json.data?.account) {
      const msg = json?.message || json?.error || `HTTP ${res.status}: Gagal menyimpan rekening`;
      throw new MitraBankAccountApiError(res.status, msg, json?.error);
    }

    return json.data.account;
  },
};

export function useMitraBankAccountCard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<MitraBankAccount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formBank, setFormBank] = useState<string>(POPULAR_BANKS[0]);
  const [formAccountNumber, setFormAccountNumber] = useState<string>("");
  const [formAccountName, setFormAccountName] = useState<string>("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const acc = await mitraBankAccountClient.getBankAccount();
      setAccount(acc);
      if (acc) {
        setIsEditing(false);
        setFormBank(acc.bank_name);
        setFormAccountNumber(acc.account_number);
        setFormAccountName(acc.bank_account_name);
      } else {
        setIsEditing(true);
        setFormBank(POPULAR_BANKS[0]);
        setFormAccountNumber("");
        setFormAccountName("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data rekening bank.";
      setLoadError(msg);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startEdit = useCallback(() => {
    if (account) {
      setFormBank(account.bank_name);
      setFormAccountNumber(account.account_number);
      setFormAccountName(account.bank_account_name);
    }
    setFieldErrors({});
    setGeneralError(null);
    setIsEditing(true);
  }, [account]);

  const cancelEdit = useCallback(() => {
    if (account) {
      setFormBank(account.bank_name);
      setFormAccountNumber(account.account_number);
      setFormAccountName(account.bank_account_name);
      setIsEditing(false);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [account]);

  const submitSave = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setFieldErrors({});
      setGeneralError(null);

      const errs: Record<string, string> = {};
      const cleanBank = formBank.trim();
      const cleanAcc = formAccountNumber.trim();
      const cleanName = formAccountName.trim();

      if (!POPULAR_BANKS.includes(cleanBank as PopularBank)) {
        errs.bank_name = "Pilihan bank tidak valid atau belum didukung";
      }

      if (!/^\d{6,20}$/.test(cleanAcc)) {
        errs.account_number = "Nomor rekening harus berupa 6 sampai 20 digit angka";
      }

      if (!cleanName) {
        errs.bank_account_name = "Nama pemilik rekening wajib diisi";
      } else if (cleanName.length > 150) {
        errs.bank_account_name = "Nama pemilik rekening maksimal 150 karakter";
      }

      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        return false;
      }

      try {
        setIsSaving(true);
        const updated = await mitraBankAccountClient.saveBankAccount({
          bank_name: cleanBank,
          account_number: cleanAcc,
          bank_account_name: cleanName,
        });
        setAccount(updated);
        setIsEditing(false);
        setSaveSuccess(true);
        notify.success("Rekening Disimpan", "Data rekening bank pencairan berhasil disimpan.");
        setTimeout(() => setSaveSuccess(false), 3000);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan data rekening bank.";
        setGeneralError(msg);
        notify.error("Gagal Menyimpan", msg);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [formBank, formAccountNumber, formAccountName]
  );

  return {
    loading,
    account,
    loadError,
    isEditing,
    formBank,
    formAccountNumber,
    formAccountName,
    fieldErrors,
    generalError,
    isSaving,
    saveSuccess,
    setFormBank,
    setFormAccountNumber,
    setFormAccountName,
    startEdit,
    cancelEdit,
    retryLoad: loadData,
    submitSave,
  };
}
