"use client";

import { useCallback, useEffect, useState } from "react";
import type { CallAnalytics } from "@/lib/analytics";
import { CallLogTable } from "@/components/dashboard/CallLogTable";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { OpsSegmentValue } from "@/lib/constants";
import { formatTriggerSource } from "@/lib/format";
import { DASHBOARD_REFRESH_MS } from "@/lib/refresh-intervals";

type Props = {
  days?: number;
  segmentFilter?: OpsSegmentValue | "ALL";
  startDate?: string;
  endDate?: string;
  todayMode?: boolean;
  embedded?: boolean;
};

export function AnalyticsTab({
  days = 14,
  segmentFilter = "ALL",
  startDate,
  endDate,
  todayMode = false,
  embedded = false,
}: Props) {
  const [data, setData] = useState<CallAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const params = new URLSearchParams({ days: String(days) });
        if (segmentFilter !== "ALL") {
          params.set("segment", segmentFilter);
        }
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const res = await fetch(`/api/analytics?${params}`);
        const json = await res.json();
        if (res.ok) setData(json);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, segmentFilter, startDate, endDate],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useAutoRefresh(() => load(true), DASHBOARD_REFRESH_MS, Boolean(data));

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading analytics…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Analytics unavailable
      </div>
    );
  }

  const maxDayCount = Math.max(...data.byDay.map((d) => d.count), 1);
  const maxHourCount = Math.max(...data.byHour.map((h) => h.count), 1);
  const maxDayStack = Math.max(
    ...data.byDayStatus.map((d) => d.completed + d.failed + d.inProgress),
    1,
  );

  return (
    <div className={`space-y-6 ${embedded ? "p-5" : ""}`}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Call analytics
            </h2>
            <p className="text-sm text-slate-500">
              {segmentFilter === "ALL"
                ? "NDR segment (live)"
                : `${segmentFilter} segment`}
            </p>
          </div>
        </div>
      )}

      {embedded && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          {todayMode
            ? "Today mode · metrics and trends are hour-first for real-time ops."
            : "Period mode · metrics and trends are day-wise for performance review."}{" "}
          Auto-refreshes every {DASHBOARD_REFRESH_MS / 1000}s.
          {refreshing && (
            <span className="ml-2 text-sky-600">Updating…</span>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total calls" value={String(data.summary.totalCalls)} />
        <StatCard
          label="Completed"
          value={String(data.summary.completed)}
          sub={`${data.summary.completionRate}% completion rate`}
        />
        <StatCard
          label="Failures"
          value={String(data.summary.apiFailures)}
          sub={`${data.summary.failureRate}% of total`}
        />
        <StatCard
          label="Positive outcomes"
          value={String(data.summary.totalPositiveOutcomes)}
          sub={`${data.summary.successRate}% of completed`}
        />
        <StatCard
          label="Manual vs auto"
          value={String(data.summary.manualTriggers)}
          sub={`${data.summary.automaticTriggers} automatic`}
        />
        <StatCard
          label="Avg duration"
          value={
            data.summary.avgDurationSec != null
              ? `${data.summary.avgDurationSec}s`
              : "—"
          }
        />
        <StatCard
          label="Cost"
          value={`₹${data.summary.totalCostInr}`}
          sub={`Avg ₹${data.summary.avgCostPerCall} / call`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            {todayMode ? "Calls by hour (today)" : "Calls by day"}
          </h3>
          <div className="mt-4 flex items-end gap-1 h-32">
            {(todayMode
              ? data.byHour.map((h) => ({ key: String(h.hour), label: `${h.hour}`, count: h.count }))
              : data.byDay.map((d) => ({ key: d.date, label: d.date.slice(5), count: d.count }))).map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-sky-400 min-h-[4px]"
                  style={{
                    height: `${Math.max(4, (d.count / (todayMode ? maxHourCount : maxDayCount)) * 100)}%`,
                  }}
                  title={`${d.count} calls`}
                />
                <span className="text-[10px] text-slate-400 rotate-0 truncate w-full text-center">
                  {d.label}
                </span>
              </div>
            ))}
            {(todayMode ? data.byHour.length === 0 : data.byDay.length === 0) && (
              <p className="text-sm text-slate-400">No data yet</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            {todayMode ? "Call volume by hour (today)" : "Status trend by day"}
          </h3>
          <div className="mt-4 flex items-end gap-1 h-32">
            {(todayMode
              ? data.byHour.map((h) => ({
                  date: `${h.hour}:00`,
                  completed: h.count,
                  failed: 0,
                  inProgress: 0,
                }))
              : data.byDayStatus
            ).map((d) => {
              const total = d.completed + d.failed + d.inProgress;
              const heightPct = Math.max(6, (total / maxDayStack) * 100);
              const completedPct = total === 0 ? 0 : (d.completed / total) * 100;
              const failedPct = total === 0 ? 0 : (d.failed / total) * 100;
              const inProgressPct = Math.max(0, 100 - completedPct - failedPct);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full min-h-[6px] overflow-hidden rounded-t bg-slate-100"
                    style={{ height: `${heightPct}%` }}
                    title={`${d.date}: done ${d.completed}, failed ${d.failed}, active ${d.inProgress}`}
                  >
                    <div className="w-full bg-emerald-400" style={{ height: `${completedPct}%` }} />
                    <div className="w-full bg-rose-400" style={{ height: `${failedPct}%` }} />
                    <div className="w-full bg-amber-300" style={{ height: `${inProgressPct}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 truncate w-full text-center">
                    {todayMode ? d.date : d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
          {!todayMode && (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-400" />Completed</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-rose-400" />Failed</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-300" />In progress / queued</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Calls by hour</h3>
          <div className="mt-4 flex items-end gap-0.5 h-32">
            {data.byHour.map((h) => (
              <div
                key={h.hour}
                className="flex-1 rounded-t bg-slate-300 min-h-[2px] hover:bg-sky-400"
                style={{
                  height: `${Math.max(2, (h.count / maxHourCount) * 100)}%`,
                }}
                title={`${h.hour}:00 — ${h.count} calls`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Hour of day (24h)</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard title="By outcome" items={data.byOutcome.map((o) => ({ label: o.outcome, count: o.count }))} />
        <BreakdownCard title="By status" items={data.byStatus.map((s) => ({ label: s.status, count: s.count }))} />
        <BreakdownCard title="By sentiment" items={data.bySentiment.map((s) => ({ label: s.sentiment, count: s.count }))} />
        <BreakdownCard
          title="API & trigger failures"
          items={data.byFailureCode.map((f) => ({
            label: f.label,
            count: f.count,
          }))}
        />
        <BreakdownCard
          title="By trigger"
          items={data.byTriggerSource.map((t) => ({
            label: formatTriggerSource(t.triggerSource),
            count: t.count,
          }))}
        />
      </div>

      <CallLogTable
        days={days}
        dashboardSegment={segmentFilter}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-slate-400">No data</li>
        ) : (
          items.map((item) => (
            <li key={item.label}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 truncate pr-2">
                  {item.label.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-slate-900">{item.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
