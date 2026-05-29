import { buildCallLogWhere } from "./call-log-query";
import { db } from "./db";
import { CALL_FAILURE_LABELS, CallOutcome, CallStatus } from "./constants";

export type CallAnalytics = {
  summary: {
    totalCalls: number;
    completed: number;
    failed: number;
    apiFailures: number;
    inProgress: number;
    queued: number;
    manualTriggers: number;
    automaticTriggers: number;
    avgDurationSec: number | null;
    totalCostInr: number;
    successRate: number;
    completionRate: number;
    failureRate: number;
    avgCostPerCall: number;
    totalPositiveOutcomes: number;
  };
  byOutcome: { outcome: string; count: number }[];
  byStatus: { status: string; count: number }[];
  bySentiment: { sentiment: string; count: number }[];
  byFailureCode: { failureCode: string; label: string; count: number }[];
  byTriggerSource: { triggerSource: string; count: number }[];
  byDay: { date: string; count: number; completed: number }[];
  byHour: { hour: number; count: number }[];
  byDayStatus: { date: string; completed: number; failed: number; inProgress: number }[];
};

export type CallAnalyticsOptions = {
  days?: number;
  segment?: string;
  startDate?: string;
  endDate?: string;
};

export async function getCallAnalytics(
  days = 14,
  options: CallAnalyticsOptions = {},
): Promise<CallAnalytics> {
  const where = buildCallLogWhere({
    days,
    startDate: options.startDate,
    endDate: options.endDate,
    page: 1,
    limit: 1,
    sort: "createdAt",
    order: "desc",
    segment: options.segment ?? "ALL",
    status: "ALL",
    trigger: "ALL",
    outcome: "ALL",
  });

  const calls = await db.call.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const completed = calls.filter((c) => c.status === CallStatus.COMPLETED);
  const failed = calls.filter((c) => c.status === CallStatus.FAILED);
  const apiFailures = calls.filter((c) => c.failureCode != null);
  const inProgress = calls.filter((c) => c.status === CallStatus.IN_PROGRESS);
  const queued = calls.filter((c) => c.status === CallStatus.QUEUED);
  const manualTriggers = calls.filter((c) => c.triggerSource === "MANUAL");
  const automaticTriggers = calls.filter((c) => c.triggerSource === "AUTOMATIC");

  const durations = completed
    .map((c) => c.durationSec)
    .filter((d): d is number => d != null);
  const avgDurationSec =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const totalCostInr = calls.reduce((sum, c) => sum + (c.costInr ?? 0), 0);

  const positiveOutcomes = new Set<string>([
    CallOutcome.REATTEMPT_CONFIRMED,
    CallOutcome.ADDRESS_UPDATE,
    CallOutcome.RESCHEDULE,
  ]);
  const successCount = completed.filter(
    (c) => c.outcome && positiveOutcomes.has(c.outcome),
  ).length;
  const successRate =
    completed.length === 0
      ? 0
      : Math.round((successCount / completed.length) * 100);
  const completionRate =
    calls.length === 0 ? 0 : Math.round((completed.length / calls.length) * 100);
  const failureRate =
    calls.length === 0 ? 0 : Math.round((failed.length / calls.length) * 100);
  const avgCostPerCall =
    calls.length === 0
      ? 0
      : Math.round((totalCostInr / Math.max(calls.length, 1)) * 100) / 100;

  const outcomeMap = new Map<string, number>();
  for (const c of calls) {
    if (c.failureCode) continue;
    const key = c.outcome ?? "PENDING";
    outcomeMap.set(key, (outcomeMap.get(key) ?? 0) + 1);
  }

  const statusMap = new Map<string, number>();
  for (const c of calls) {
    statusMap.set(c.status, (statusMap.get(c.status) ?? 0) + 1);
  }

  const sentimentMap = new Map<string, number>();
  for (const c of completed) {
    if (c.sentiment) {
      sentimentMap.set(c.sentiment, (sentimentMap.get(c.sentiment) ?? 0) + 1);
    }
  }

  const failureMap = new Map<string, number>();
  for (const c of apiFailures) {
    const key = c.failureCode ?? "UNKNOWN";
    failureMap.set(key, (failureMap.get(key) ?? 0) + 1);
  }

  const triggerMap = new Map<string, number>();
  for (const c of calls) {
    triggerMap.set(c.triggerSource, (triggerMap.get(c.triggerSource) ?? 0) + 1);
  }

  const dayMap = new Map<string, { count: number; completed: number; failed: number; inProgress: number }>();
  for (const c of calls) {
    const date = c.createdAt.toISOString().slice(0, 10);
    const cur = dayMap.get(date) ?? { count: 0, completed: 0, failed: 0, inProgress: 0 };
    cur.count += 1;
    if (c.status === CallStatus.COMPLETED) cur.completed += 1;
    if (c.status === CallStatus.FAILED) cur.failed += 1;
    if (c.status === CallStatus.IN_PROGRESS || c.status === CallStatus.QUEUED) cur.inProgress += 1;
    dayMap.set(date, cur);
  }

  const hourMap = new Map<number, number>();
  for (const c of calls) {
    const h = c.createdAt.getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }

  const byDay = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byDayStatus = byDay.map((d) => ({
    date: d.date,
    completed: d.completed,
    failed: d.failed,
    inProgress: d.inProgress,
  }));

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) ?? 0,
  }));

  return {
    summary: {
      totalCalls: calls.length,
      completed: completed.length,
      failed: failed.length,
      apiFailures: apiFailures.length,
      inProgress: inProgress.length,
      queued: queued.length,
      manualTriggers: manualTriggers.length,
      automaticTriggers: automaticTriggers.length,
      avgDurationSec,
      totalCostInr: Math.round(totalCostInr * 100) / 100,
      successRate,
      completionRate,
      failureRate,
      avgCostPerCall,
      totalPositiveOutcomes: successCount,
    },
    byOutcome: Array.from(outcomeMap.entries()).map(([outcome, count]) => ({
      outcome,
      count,
    })),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    bySentiment: Array.from(sentimentMap.entries()).map(([sentiment, count]) => ({
      sentiment,
      count,
    })),
    byFailureCode: Array.from(failureMap.entries()).map(([failureCode, count]) => ({
      failureCode,
      label: CALL_FAILURE_LABELS[failureCode] ?? failureCode,
      count,
    })),
    byTriggerSource: Array.from(triggerMap.entries()).map(
      ([triggerSource, count]) => ({
        triggerSource,
        count,
      }),
    ),
    byDay,
    byHour,
    byDayStatus,
  };
}
