"use client";

import { toast } from "sonner";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

export const notify = {
  success: (title: string, descriptionOrOptions?: string | ToastOptions, action?: ToastAction) => {
    if (typeof descriptionOrOptions === "string") {
      return toast.success(title, {
        description: descriptionOrOptions,
        duration: 3500,
        action: action ? { label: action.label, onClick: action.onClick } : undefined,
      });
    }
    const resolvedAction = descriptionOrOptions?.action || action;
    return toast.success(title, {
      description: descriptionOrOptions?.description,
      duration: descriptionOrOptions?.duration || 3500,
      action: resolvedAction ? {
        label: resolvedAction.label,
        onClick: resolvedAction.onClick,
      } : undefined,
    });
  },

  error: (title: string, descriptionOrOptions?: string | ToastOptions, action?: ToastAction) => {
    if (typeof descriptionOrOptions === "string") {
      return toast.error(title, {
        description: descriptionOrOptions,
        duration: 4500,
        action: action ? { label: action.label, onClick: action.onClick } : undefined,
      });
    }
    const resolvedAction = descriptionOrOptions?.action || action;
    return toast.error(title, {
      description: descriptionOrOptions?.description,
      duration: descriptionOrOptions?.duration || 4500,
      action: resolvedAction ? {
        label: resolvedAction.label,
        onClick: resolvedAction.onClick,
      } : undefined,
    });
  },

  warning: (title: string, descriptionOrOptions?: string | ToastOptions, action?: ToastAction) => {
    if (typeof descriptionOrOptions === "string") {
      return toast.warning(title, {
        description: descriptionOrOptions,
        duration: 4000,
        action: action ? { label: action.label, onClick: action.onClick } : undefined,
      });
    }
    const resolvedAction = descriptionOrOptions?.action || action;
    return toast.warning(title, {
      description: descriptionOrOptions?.description,
      duration: descriptionOrOptions?.duration || 4000,
      action: resolvedAction ? {
        label: resolvedAction.label,
        onClick: resolvedAction.onClick,
      } : undefined,
    });
  },

  info: (title: string, descriptionOrOptions?: string | ToastOptions, action?: ToastAction) => {
    if (typeof descriptionOrOptions === "string") {
      return toast.info(title, {
        description: descriptionOrOptions,
        duration: 3500,
        action: action ? { label: action.label, onClick: action.onClick } : undefined,
      });
    }
    const resolvedAction = descriptionOrOptions?.action || action;
    return toast.info(title, {
      description: descriptionOrOptions?.description,
      duration: descriptionOrOptions?.duration || 3500,
      action: resolvedAction ? {
        label: resolvedAction.label,
        onClick: resolvedAction.onClick,
      } : undefined,
    });
  },

  // Khusus Notifikasi Krisis (Eskalasi Medis Darurat)
  crisis: (title: string, description: string, action?: ToastAction) => {
    return toast.error(`🚨 ${title}`, {
      description,
      duration: 7000,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    });
  },

  // Khusus Notifikasi Jadwal & Sesi Konseling Baru
  schedule: (title: string, description: string, action?: ToastAction) => {
    return toast.info(`📅 ${title}`, {
      description,
      duration: 5000,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    });
  },

  // Khusus Notifikasi Payout & Keuangan
  payout: (title: string, description: string, action?: ToastAction) => {
    return toast.success(`💳 ${title}`, {
      description,
      duration: 4500,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    });
  },
};
