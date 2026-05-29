"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { DASHBOARD_REFRESH_MS } from "@/lib/refresh-intervals";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import type { CallLogRow, CallLogSortField, SortOrder } from "@/lib/call-log-query";
import type { OpsSegmentValue } from "@/lib/constants";
import {
  formatDateTime,
  formatFailureCode,
  formatSegment,
  formatTriggerSource,
} from "@/lib/format";
import { SEGMENT_ACCENT } from "@/lib/navigation";

type TableFilters = {
  segment: string;
  status: string;
  trigger: string;
  outcome: string;
  startDate: string;
  endDate: string;
};

type Props = {
  days: number;
  /** Sync from dashboard segment chips (ALL keeps table filter independent) */
  dashboardSegment?: OpsSegmentValue | "ALL";
  startDate?: string;
  endDate?: string;
};

function HeaderSelect({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  "aria-label": string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="mt-1 w-full min-w-[5.5rem] max-w-[8.5rem] rounded border border-slate-200 bg-white py-1 pl-1.5 pr-6 text-[11px] font-normal normal-case text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SortableHeader({
  label,
  active,
  order,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  order: SortOrder;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active ? (order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${active ? "text-sky-600" : "text-slate-400"}`} />
    </button>
  );
}

const DEFAULT_FILTERS: TableFilters = {
  segment: "ALL",
  status: "ALL",
  trigger: "ALL",
  outcome: "ALL",
  startDate: "",
  endDate: "",
};

export function CallLogTable({
  days,
  dashboardSegment = "ALL",
  startDate,
  endDate,
}: Props) {
  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<CallLogSortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [filters, setFilters] = useState<TableFilters>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<{
    segments: string[];
    statuses: string[];
    triggers: string[];
    outcomes: string[];
  } | null>(null);
  const [pollReady, setPollReady] = useState(false);

  useEffect(() => {
    if (dashboardSegment !== "ALL") {
      setFilters((f) => ({ ...f, segment: dashboardSegment }));
      setPage(1);
    }
  }, [dashboardSegment]);

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      startDate: startDate ? startDate.slice(0, 10) : f.startDate,
      endDate: endDate ? endDate.slice(0, 10) : f.endDate,
    }));
  }, [startDate, endDate]);

  const load = useCallback(async (silent = false) => {
    if (!silent || !pollReady) setLoading(true);
    const params = new URLSearchParams({
      days: String(days),
      page: String(page),
      limit: String(limit),
      sort,
      order,
      segment: filters.segment,
      status: filters.status,
      trigger: filters.trigger,
      outcome: filters.outcome,
    });
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    const res = await fetch(`/api/analytics/calls?${params}`);
    const text = await res.text();
    if (!text.trim()) {
      setLoading(false);
      return;
    }

    const data = JSON.parse(text);
    if (res.ok) {
      setRows(data.rows ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      if (data.filterOptions) setFilterOptions(data.filterOptions);
      setPollReady(true);
    }
    setLoading(false);
  }, [days, page, limit, sort, order, filters]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useAutoRefresh(() => load(true), DASHBOARD_REFRESH_MS, pollReady);

  function patchFilter(patch: Partial<TableFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function toggleSort(field: CallLogSortField) {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  const segmentOptions =
    filterOptions?.segments.map((v) => ({
      value: v,
      label: v === "ALL" ? "All" : formatSegment(v),
    })) ?? [];

  const statusOptions =
    filterOptions?.statuses.map((v) => ({
      value: v,
      label: v === "ALL" ? "All" : v.replace(/_/g, " "),
    })) ?? [];

  const triggerOptions =
    filterOptions?.triggers.map((v) => ({
      value: v,
      label: v === "ALL" ? "All" : formatTriggerSource(v),
    })) ?? [];

  const outcomeOptions =
    filterOptions?.outcomes.map((v) => ({
      value: v,
      label:
        v === "ALL"
          ? "All"
          : v === "API_FAILURE"
            ? "API failure"
            : v === "PENDING"
              ? "Pending"
              : v.replace(/_/g, " "),
    })) ?? [];

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Call log</h3>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            From
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => patchFilter({ startDate: e.target.value })}
              className="input mt-1 h-8 py-1 text-xs"
            />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => patchFilter({ endDate: e.target.value })}
              className="input mt-1 h-8 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({ ...f, startDate: "", endDate: "" }))
            }
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear dates
          </button>
          <p className="text-xs text-slate-500 sm:ml-auto">
            Filter by headers/date · auto-refresh {DASHBOARD_REFRESH_MS / 1000}s
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 align-top">
            <tr className="text-xs uppercase text-slate-500">
              <th className="px-4 py-2 text-left font-semibold">Reference</th>
              <th className="px-4 py-2 text-left font-semibold">Contact</th>
              <th className="px-4 py-2 text-left font-semibold">
                <span className="block">Segment</span>
                <HeaderSelect
                  aria-label="Filter by segment"
                  value={filters.segment}
                  onChange={(v) => patchFilter({ segment: v })}
                  options={segmentOptions}
                />
              </th>
              <th className="px-4 py-2 text-left font-semibold">
                <span className="block">Trigger</span>
                <HeaderSelect
                  aria-label="Filter by trigger"
                  value={filters.trigger}
                  onChange={(v) => patchFilter({ trigger: v })}
                  options={triggerOptions}
                />
              </th>
              <th className="px-4 py-2 text-left font-semibold">
                <span className="block">Status</span>
                <HeaderSelect
                  aria-label="Filter by status"
                  value={filters.status}
                  onChange={(v) => patchFilter({ status: v })}
                  options={statusOptions}
                />
              </th>
              <th className="px-4 py-2 text-left font-semibold">
                <span className="block">Outcome</span>
                <HeaderSelect
                  aria-label="Filter by outcome"
                  value={filters.outcome}
                  onChange={(v) => patchFilter({ outcome: v })}
                  options={outcomeOptions}
                />
              </th>
              <th className="px-4 py-3 text-right font-semibold">
                <SortableHeader
                  label="Duration"
                  active={sort === "durationSec"}
                  order={order}
                  onClick={() => toggleSort("durationSec")}
                  align="right"
                />
              </th>
              <th className="px-4 py-3 text-right font-semibold">
                <SortableHeader
                  label="Created"
                  active={sort === "createdAt"}
                  order={order}
                  onClick={() => toggleSort("createdAt")}
                  align="right"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  Loading calls…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  No calls match these filters
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const segmentKey = c.segment || "NDR";
                const accent =
                  SEGMENT_ACCENT[segmentKey as keyof typeof SEGMENT_ACCENT] ??
                  SEGMENT_ACCENT.dashboard;

                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{c.orderId}</td>
                    <td className="px-4 py-2 text-slate-600">{c.customerName}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${accent.badge}`}
                      >
                        {formatSegment(c.segment)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.triggerSource === "AUTOMATIC"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatTriggerSource(c.triggerSource)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-slate-600">{c.status}</span>
                    </td>
                    <td className="max-w-xs px-4 py-2">
                      {c.failureCode ? (
                        <div>
                          <p className="text-xs font-medium text-rose-700">
                            {formatFailureCode(c.failureCode)}
                          </p>
                          {c.failureMessage && (
                            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                              {c.failureMessage}
                            </p>
                          )}
                        </div>
                      ) : c.outcome ? (
                        <StatusBadge status={c.outcome} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {c.durationSec != null ? `${c.durationSec}s` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-400">
                      {formatDateTime(c.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
