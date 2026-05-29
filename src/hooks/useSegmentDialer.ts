"use client";

import { useCallback, useEffect, useState } from "react";
import type { DialerSettingsDto } from "@/lib/dialer";
import { DASHBOARD_REFRESH_MS } from "@/lib/refresh-intervals";

type SegmentDialerOptions = {
  settingsPath: string;
  label?: string;
};

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) {
    console.error(`API ${res.url} returned empty body (HTTP ${res.status})`);
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`API ${res.url} returned invalid JSON (HTTP ${res.status})`);
    return null;
  }
}

export function useSegmentDialer(
  onQueueRefresh: () => void,
  options: SegmentDialerOptions,
) {
  const [settings, setSettings] = useState<DialerSettingsDto | null>(null);
  const [activeCalls, setActiveCalls] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const label = options.label ?? "Background worker";

  const load = useCallback(async () => {
    const res = await fetch(options.settingsPath);
    const data = await parseJsonResponse<{
      settings?: DialerSettingsDto;
      activeCalls?: number;
      error?: string;
    }>(res);

    if (!data) {
      setLoadError("Could not load dialer settings");
      return null;
    }

    if (!res.ok) {
      setLoadError(data.error ?? "Could not load dialer settings");
      return null;
    }

    setLoadError(null);
    setSettings(data.settings ?? null);
    setActiveCalls(data.activeCalls ?? 0);

    if (data.settings?.enabled) {
      setLastResult((prev) => (prev?.startsWith(label) ? prev : `${label} active`));
    } else {
      setLastResult(null);
    }

    return data as { settings: DialerSettingsDto; activeCalls: number };
  }, [options.settingsPath, label]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), DASHBOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!settings?.enabled) return;
    onQueueRefresh();
    const id = setInterval(onQueueRefresh, DASHBOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [settings?.enabled, onQueueRefresh]);

  async function save(partial: Partial<DialerSettingsDto>) {
    setSaving(true);
    const res = await fetch(options.settingsPath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const data = await parseJsonResponse<{
      settings?: DialerSettingsDto;
      error?: string;
    }>(res);

    if (data?.settings) {
      setSettings(data.settings);
      setLoadError(null);
      if (data.settings.enabled) {
        setLastResult(`${label} active`);
      }
    } else if (data?.error) {
      setLoadError(data.error);
    }
    setSaving(false);
  }

  return {
    settings,
    activeCalls,
    lastResult,
    loadError,
    saving,
    save,
    reload: load,
  };
}

