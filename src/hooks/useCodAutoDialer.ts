"use client";

import { useSegmentDialer } from "./useSegmentDialer";

export function useCodAutoDialer(onRefresh: () => void) {
  return useSegmentDialer(onRefresh, {
    settingsPath: "/api/cod/dialer/settings",
  });
}

