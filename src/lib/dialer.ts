import { CallTriggerSource, OpsSegment, ShipmentStatus, type OpsSegmentValue } from "./constants";
import { db } from "./db";
import { parseDialerFilters, type DialerFilters } from "./dialer-filters";
import { countActiveCalls, triggerCallForShipment } from "./trigger-call";

const CALLABLE = [
  ShipmentStatus.NDR_PENDING,
  ShipmentStatus.NO_ANSWER,
  ShipmentStatus.RESCHEDULED,
];

export type DialerSettingsDto = {
  enabled: boolean;
  batchSize: number;
  delayBetweenBatchesMs: number;
  delayBetweenCallsMs: number;
  filters: DialerFilters;
  lastBatchAt: string | null;
  lastCallTriggeredAt: string | null;
  lastProcessedAt: string | null;
};

export async function getOrCreateDialerSettings(segment: OpsSegmentValue = OpsSegment.NDR) {
  let settings = await db.dialerSettings.findUnique({ where: { id: segment } });
  if (!settings && segment === OpsSegment.NDR) {
    const legacy = await db.dialerSettings.findUnique({ where: { id: "default" } });
    if (legacy) {
      settings = await db.dialerSettings.update({
        where: { id: "default" },
        data: { id: OpsSegment.NDR, segment: OpsSegment.NDR },
      });
    }
  }
  if (!settings) {
    settings = await db.dialerSettings.create({
      data: { id: segment, segment },
    });
  }
  return settings;
}

export function toDialerDto(s: {
  enabled: boolean;
  batchSize: number;
  delayBetweenBatchesMs: number;
  delayBetweenCallsMs: number;
  filters: string | null;
  lastBatchAt: Date | null;
  lastCallTriggeredAt: Date | null;
  lastProcessedAt: Date | null;
}): DialerSettingsDto {
  return {
    enabled: s.enabled,
    batchSize: s.batchSize,
    delayBetweenBatchesMs: s.delayBetweenBatchesMs,
    delayBetweenCallsMs: s.delayBetweenCallsMs,
    filters: parseDialerFilters(s.filters),
    lastBatchAt: s.lastBatchAt?.toISOString() ?? null,
    lastCallTriggeredAt: s.lastCallTriggeredAt?.toISOString() ?? null,
    lastProcessedAt: s.lastProcessedAt?.toISOString() ?? null,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type DialerProcessResult = {
  triggered: number;
  skipped: number;
  errors: string[];
  activeCalls: number;
  waitingForBatch: boolean;
  waitingForCallDelay: boolean;
};

export type DialerTarget = { id: string; meta?: Record<string, unknown> };
type DialerTriggerResult = { ok: boolean; error?: string };
type DialerStrategy = {
  countActive: () => Promise<number>;
  pickTargets: (slots: number) => Promise<DialerTarget[]>;
  trigger: (target: DialerTarget) => Promise<DialerTriggerResult>;
};

/**
 * Auto-dialer timing:
 * - batchSize: max parallel calls (QUEUED + IN_PROGRESS)
 * - delayBetweenCallsMs: min gap between starting each call in the current batch
 * - delayBetweenBatchesMs: min gap after a batch ends (active → 0) before the next batch
 */
export async function processDialerQueue(
  segment: OpsSegmentValue = OpsSegment.NDR,
): Promise<DialerProcessResult> {
  const settings = await getOrCreateDialerSettings(segment);
  const filters = parseDialerFilters(settings.filters).ndr;
  return processSegmentDialerQueue(segment, {
    countActive: () => countActiveCalls(segment),
    pickTargets: async (slots: number) =>
      db.shipment.findMany({
        where: {
          status: {
            in: applyEqualityToStatuses(filters?.status) ?? CALLABLE,
          },
          ...(filters?.cost
            ? {
                orderAmount: numericCondition(filters.cost),
              }
            : {}),
          ...(filters?.reasonStatus
            ? {
                ndrReason:
                  filters.reasonStatus.op === "eq"
                    ? filters.reasonStatus.value
                    : { not: filters.reasonStatus.value },
              }
            : {}),
          ...(filters?.date
            ? {
                createdAt:
                  filters.date.op === "gt"
                    ? { gt: new Date(filters.date.value) }
                    : { lt: new Date(filters.date.value) },
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        take: slots,
        select: { id: true },
      }),
    trigger: async ({ id }) => {
      const outcome = await triggerCallForShipment(id, {
        triggerSource: CallTriggerSource.AUTOMATIC,
        segment,
      });
      return outcome.ok
        ? { ok: true }
        : { ok: false, error: outcome.error };
    },
  });
}

function numericCondition(filter: { op: "gt" | "lt" | "eq"; value: number }) {
  if (filter.op === "gt") return { gt: filter.value };
  if (filter.op === "lt") return { lt: filter.value };
  return { equals: filter.value };
}

function applyEqualityToStatuses(
  filter: { op: "eq" | "neq"; value: string } | undefined,
): string[] | null {
  if (!filter) return null;
  if (filter.op === "eq") {
    return CALLABLE.includes(filter.value as (typeof CALLABLE)[number])
      ? [filter.value]
      : [];
  }
  return CALLABLE.filter((x) => x !== filter.value);
}

export async function processSegmentDialerQueue(
  segment: OpsSegmentValue,
  strategy: DialerStrategy,
): Promise<DialerProcessResult> {
  let settings = await getOrCreateDialerSettings(segment);
  const result: DialerProcessResult = {
    triggered: 0,
    skipped: 0,
    errors: [],
    activeCalls: 0,
    waitingForBatch: false,
    waitingForCallDelay: false,
  };

  if (!settings.enabled) {
    return result;
  }

  const now = Date.now();
  const activeAtStart = await strategy.countActive();
  result.activeCalls = activeAtStart;

  // Calls finished since last tick — start between-batch cooldown
  if (activeAtStart === 0 && settings.lastCallTriggeredAt) {
    const batchEndMarked =
      settings.lastBatchAt &&
      settings.lastBatchAt.getTime() >= settings.lastCallTriggeredAt.getTime();
    if (!batchEndMarked) {
      await setLastBatchAt(segment);
      settings = await getOrCreateDialerSettings(segment);
    }
  }

  if (activeAtStart >= settings.batchSize) {
    await touchProcessed(segment);
    return result;
  }

  // Between batches: only when idle — don't block filling an in-flight batch
  if (activeAtStart === 0 && settings.lastBatchAt) {
    const elapsed = now - settings.lastBatchAt.getTime();
    if (elapsed < settings.delayBetweenBatchesMs) {
      result.waitingForBatch = true;
      await touchProcessed(segment);
      return result;
    }
  }

  // Between calls in the same batch (across poll ticks and within one run)
  if (settings.lastCallTriggeredAt && settings.delayBetweenCallsMs > 0) {
    const sinceLastCall = now - settings.lastCallTriggeredAt.getTime();
    if (sinceLastCall < settings.delayBetweenCallsMs) {
      result.waitingForCallDelay = true;
      await touchProcessed(segment);
      return result;
    }
  }

  const slots = settings.batchSize - activeAtStart;
  const toCall = await strategy.pickTargets(slots);

  if (toCall.length === 0) {
    await markBatchEndedIfIdle(segment, activeAtStart, strategy.countActive);
    await touchProcessed(segment);
    return result;
  }

  let triggeredInRun = 0;

  for (let i = 0; i < toCall.length; i++) {
    const target = toCall[i];

    const currentActive = await strategy.countActive();
    if (currentActive >= settings.batchSize) {
      break;
    }

    // Stagger starts within a single process invocation
    if (i > 0 && settings.delayBetweenCallsMs > 0) {
      await sleep(settings.delayBetweenCallsMs);
    }

    const outcome = await strategy.trigger(target);

    if (outcome.ok) {
      triggeredInRun += 1;
      result.triggered += 1;
      await db.dialerSettings.update({
        where: { id: segment },
        data: { lastCallTriggeredAt: new Date() },
      });
    } else {
      result.errors.push(`${target.id}: ${outcome.error}`);
      result.skipped += 1;
    }
  }

  const activeAtEnd = await strategy.countActive();
  result.activeCalls = activeAtEnd;

  // Batch ended: had active calls, now none (e.g. fast failures or all completed)
  if (activeAtStart > 0 && activeAtEnd === 0) {
    await setLastBatchAt(segment);
  }

  // Started a batch from idle and immediately filled or exhausted queue with no active
  if (activeAtStart === 0 && triggeredInRun > 0 && activeAtEnd === 0) {
    await setLastBatchAt(segment);
  }

  await touchProcessed(segment);
  return result;
}

async function touchProcessed(segment: OpsSegmentValue) {
  await db.dialerSettings.update({
    where: { id: segment },
    data: { lastProcessedAt: new Date() },
  });
}

async function setLastBatchAt(segment: OpsSegmentValue) {
  await db.dialerSettings.update({
    where: { id: segment },
    data: { lastBatchAt: new Date() },
  });
}

/** When queue is empty but calls were in flight, mark batch end for cooldown. */
async function markBatchEndedIfIdle(segment: OpsSegmentValue, activeAtStart: number, countActive: () => Promise<number>) {
  const active = await countActive();
  if (activeAtStart > 0 && active === 0) {
    await setLastBatchAt(segment);
  }
}
