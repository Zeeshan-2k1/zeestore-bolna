import { CallTriggerSource, OpsSegment } from "./constants";
import { parseDialerFilters } from "./dialer-filters";
import { getOrCreateDialerSettings, processSegmentDialerQueue, toDialerDto, type DialerProcessResult, type DialerSettingsDto } from "./dialer";
import { getPotentialLeadIds } from "./lead-query";
import { countActiveLeadCalls, triggerLeadCall } from "./lead-trigger-call";

export async function getOrCreateLeadDialerSettings() {
  return getOrCreateDialerSettings(OpsSegment.LEADS);
}

export const toLeadDialerDto = toDialerDto;
export type LeadDialerSettingsDto = DialerSettingsDto;
export type LeadDialerProcessResult = DialerProcessResult;

export async function processLeadDialerQueue(): Promise<LeadDialerProcessResult> {
  const settings = await getOrCreateLeadDialerSettings();
  const leadFilters = parseDialerFilters(settings.filters).leads;
  return processSegmentDialerQueue(OpsSegment.LEADS, {
    countActive: countActiveLeadCalls,
    pickTargets: (slots) =>
      getPotentialLeadIds(slots, leadFilters).then((targets) =>
        targets.map((t) => ({ id: t.id, meta: { leadScore: t.score } })),
      ),
    trigger: async ({ id, meta }) => {
      const outcome = await triggerLeadCall(id, {
        triggerSource: CallTriggerSource.AUTOMATIC,
        leadScore: typeof meta?.leadScore === "number" ? meta.leadScore : undefined,
      });
      return outcome.ok
        ? { ok: true }
        : { ok: false, error: outcome.error };
    },
  });
}

