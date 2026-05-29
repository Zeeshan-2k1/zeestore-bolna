"use client";

import { useSegmentDialer } from "./useSegmentDialer";

export function useAutoDialer(onQueueRefresh: () => void) {
  return useSegmentDialer(onQueueRefresh, {
    settingsPath: "/api/dialer/settings",
  });
}
