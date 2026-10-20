"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { passwordFormSchema, type PasswordFormDTO } from "@/lib/validations/auth";
import { passwordClient } from "@/services/password.client";
import { handleUnauthorized } from "@/lib/auth/unauthorized-handler";

export interface PasswordFormProps {
  className?: string;
}

type FieldKey = "current_password" | "new_password" | "confirm_password";

interface PasswordFieldProps {
  id: FieldKey;
  name: FieldKey;
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  className?: string;
}

function PasswordField({
  id,
  name,
  label,
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
  disabled,
  className,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label
        htmlFor={id}
        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
      >
        {label}
      </Label>
      <PasswordInput
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 rounded-xl"
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold min-w-0 break-words"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordForm({ className }: PasswordFormProps = {}) {
  const isMountedRef = useRef(true);

  // Status kata sandi dari server
  const [hasPassword, setHasPassword] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Field input form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // State error & submit
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setLoadError(null);
    try {
      const res = await passwordClient.getStatus();
      if (!isMountedRef.current) return;

      if ("error" in res) {
        setLoadError(res.error);
      } else {
        setHasPassword(res.hasPassword);
      }
    } catch {
      if (isMountedRef.current) {
        setLoadError("Gagal memuat status kata sandi. Coba lagi beberapa saat lagi.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingStatus(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadStatus();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadStatus]);

  const handleChange = (
    field: FieldKey,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (serverErrorMessage) {
      setServerErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || loadingStatus) return;

    setServerErrorMessage(null);
    setErrors({});

    const schema = passwordFormSchema(hasPassword);
    const payload: PasswordFormDTO = {
      ...(hasPassword ? { current_password: currentPassword } : {}),
      new_password: newPassword,
      confirm_password: confirmPassword,
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldKey | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await passwordClient.update(parsed.data);

      if (!result.ok) {
        if (result.kind === "wrong_password") {
          setErrors({ current_password: result.message });
        } else if (result.kind === "validation") {
          if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
            setErrors(result.fieldErrors);
          } else {
            setServerErrorMessage(result.message);
          }
        } else {
          setServerErrorMessage(result.message);
        }
        return;
      }

      // Sukses
      if (result.sessionRenewed) {
        if (result.mode === "create") {
          notify.success(
            "Kata sandi berhasil dibuat. Sekarang kamu juga bisa masuk dengan email dan kata sandi."
          );
          setHasPassword(true);
        } else {
          notify.success("Kata sandi berhasil diperbarui.");
        }
      } else {
        notify.warning(
          "Kata sandi berhasil diubah. Silakan masuk kembali dengan kata sandi baru."
        );
        setTimeout(() => {
          handleUnauthorized();
        }, 3000);
      }

      // Kosongkan form setelah berhasil
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
      setServerErrorMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div
        className={cn("space-y-3.5 w-full max-w-lg min-w-0", className)}
        data-testid="password-form-skeleton"
      >
        <Skeleton className="h-4 w-36 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
          <div className="space-y-1.5 sm:col-span-2 min-w-0">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-xl mt-1" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn("space-y-3 w-full max-w-lg min-w-0", className)}>
        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading min-w-0">
          Ganti Kata Sandi Akun
        </p>
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0"
        >
          <span className="min-w-0 break-words">{loadError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadStatus}
            className="text-xs h-8 shrink-0 rounded-lg border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer"
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn("space-y-3.5 w-full max-w-lg min-w-0", className)}
    >
      <div className="space-y-0.5 min-w-0">
        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading min-w-0">
          {hasPassword ? "Ganti Kata Sandi Akun" : "Buat Kata Sandi"}
        </p>
        {!hasPassword && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito min-w-0">
            Akun Google kamu belum memiliki kata sandi. Buat kata sandi untuk dapat masuk dengan email dan kata sandi.
          </p>
        )}
      </div>

      {serverErrorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 min-w-0 break-words"
        >
          {serverErrorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full min-w-0">
        {hasPassword && (
          <PasswordField
            id="current_password"
            name="current_password"
            label="Kata Sandi Lama"
            placeholder="Masukkan kata sandi lama"
            value={currentPassword}
            onChange={handleChange("current_password", setCurrentPassword)}
            error={errors.current_password}
            autoComplete="current-password"
            disabled={isSubmitting}
            className="sm:col-span-2"
          />
        )}

        <PasswordField
          id="new_password"
          name="new_password"
          label="Kata Sandi Baru"
          placeholder="Minimal 8 karakter"
          value={newPassword}
          onChange={handleChange("new_password", setNewPassword)}
          error={errors.new_password}
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <PasswordField
          id="confirm_password"
          name="confirm_password"
          label="Konfirmasi Kata Sandi"
          placeholder="Ulangi kata sandi baru"
          value={confirmPassword}
          onChange={handleChange("confirm_password", setConfirmPassword)}
          error={errors.confirm_password}
          autoComplete="new-password"
          disabled={isSubmitting}
        />
      </div>

      <div className="pt-1">
        <Button
          type="submit"
          disabled={isSubmitting}
          size="sm"
          className="text-xs rounded-xl cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5 shrink-0" aria-hidden="true" />
              <span>Menyimpan...</span>
            </>
          ) : (
            hasPassword ? "Perbarui Kata Sandi" : "Buat Kata Sandi"
          )}
        </Button>
      </div>
    </form>
  );
}
