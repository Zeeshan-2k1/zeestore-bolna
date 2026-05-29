"use client";

import { useEffect, useRef } from "react";

/** Poll `callback` on an interval (e.g. dashboard metrics). */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      void saved.current();
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
