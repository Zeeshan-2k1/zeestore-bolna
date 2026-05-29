"use client";

import { useSegmentDialer } from "./useSegmentDialer";

export function useLeadAutoDialer(onRefresh: () => void) {
  return useSegmentDialer(onRefresh, {
    settingsPath: "/api/leads/dialer/settings",
  });
}

