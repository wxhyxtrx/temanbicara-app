"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_PUBLIC_SETTINGS } from "@/constant/system-settings";
import {
  systemSettingsService,
  type PublicSettingsResult,
} from "@/services/system-settings.service";

export function usePublicSettings() {
  const [data, setData] = useState<PublicSettingsResult>({
    settings: DEFAULT_PUBLIC_SETTINGS,
    isFallback: true,
    canTransact: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const result = await systemSettingsService.getPublicSettings();
    setData(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings: data.settings,
    isLoading,
    isError: Boolean(data.error),
    isFallback: data.isFallback,
    canTransact: data.canTransact,
    error: data.error,
    refetch: fetchSettings,
  };
}
