import { getOrCreateDialerSettings, processDialerQueue } from "./dialer";
import type { DialerProcessResult } from "./dialer";
import {
  getOrCreateLeadDialerSettings,
  processLeadDialerQueue,
  type LeadDialerProcessResult,
} from "./lead-dialer";
import {
  getOrCreateCodDialerSettings,
  processCodDialerQueue,
  type CodDialerProcessResult,
} from "./cod-dialer";

export type DialerTickResult =
  | { ran: false; reason: "disabled" }
  | { ran: true; result: DialerProcessResult };

/** Single auto-dialer iteration (used by background worker and cron). */
export async function runDialerTick(): Promise<DialerTickResult> {
  const settings = await getOrCreateDialerSettings();
  if (!settings.enabled) {
    return { ran: false, reason: "disabled" };
  }
  const result = await processDialerQueue();
  return { ran: true, result };
}

export type LeadDialerTickResult =
  | { ran: false; reason: "disabled" }
  | { ran: true; result: LeadDialerProcessResult };

export async function runLeadDialerTick(): Promise<LeadDialerTickResult> {
  const settings = await getOrCreateLeadDialerSettings();
  if (!settings.enabled) {
    return { ran: false, reason: "disabled" };
  }
  const result = await processLeadDialerQueue();
  return { ran: true, result };
}

export type CodDialerTickResult =
  | { ran: false; reason: "disabled" }
  | { ran: true; result: CodDialerProcessResult };

export async function runCodDialerTick(): Promise<CodDialerTickResult> {
  const settings = await getOrCreateCodDialerSettings();
  if (!settings.enabled) {
    return { ran: false, reason: "disabled" };
  }
  const result = await processCodDialerQueue();
  return { ran: true, result };
}
