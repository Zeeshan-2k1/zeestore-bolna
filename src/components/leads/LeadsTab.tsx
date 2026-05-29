"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { SelectField } from "@/components/ui/SelectField";
import { formatStatusLabel } from "@/lib/format";
import type { LeadRow } from "@/lib/lead-query";
import { LeadTable } from "./LeadTable";

type Props = {
  refreshKey: number;
  onRefresh: () => void;
};

type LeadSortField = "score" | "lastActivityAt" | "createdAt";

type LeadApi = {
  leads: LeadRow[];
  summary: { totalPotential: number; hot: number; warm: number; cold: number };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function LeadsTab({ refreshKey, onRefresh }: Props) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [summary, setSummary] = useState<LeadApi["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<LeadSortField>("score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [intent, setIntent] = useState("");
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
        order,
      });
      if (searchDebounced) params.set("search", searchDebounced);
      if (intent) params.set("intent", intent);

      const res = await fetch(`/api/leads?${params}`, { cache: "no-store" });
      const data = (await res.json()) as LeadApi & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load leads");
      }

      setRows(data.leads ?? []);
      setSummary(data.summary ?? null);
      if (data.pagination) {
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
      setLoadError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load leads table";
      setRows([]);
      setSummary(null);
      setTotal(0);
      setTotalPages(1);
      setLoadError(message);
      setToast({ type: "err", msg: message });
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, order, searchDebounced, intent]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  function handleSort(field: LeadSortField) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder(field === "score" ? "desc" : "asc");
    }
    setPage(1);
  }

  async function handleTriggerCall(id: string) {
    setTriggeringId(id);
    setToast(null);
    const res = await fetch(`/api/leads/${id}/trigger-call`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "err", msg: data.error ?? "Call failed" });
      setTriggeringId(null);
      return;
    }
    setToast({
      type: "ok",
      msg: `Lead call started`,
    });
    setTriggeringId(null);
    await load();
    onRefresh();
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading leads…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Potential leads" value={String(summary.totalPotential)} />
          <Kpi label="Hot" value={String(summary.hot)} />
          <Kpi label="Warm" value={String(summary.warm)} />
          <Kpi label="Cold" value={String(summary.cold)} />
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-search"
              />
            </div>
            <SelectField
              value={intent}
              onChange={(v) => {
                setIntent(v);
                setPage(1);
              }}
              aria-label="Filter by intent"
            >
              <option value="">All intent</option>
              {["HOT", "WARM", "COLD"].map((x) => (
                <option key={x} value={x}>
                  {formatStatusLabel(x)}
                </option>
              ))}
            </SelectField>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIntent("");
              setPage(1);
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        </div>
      </div>

      <LeadTable
        leads={rows}
        sort={sort}
        order={order}
        onSort={handleSort}
        onTriggerCall={handleTriggerCall}
        triggeringId={triggeringId}
      />
      {loadError && (
        <p className="text-sm text-rose-600">
          Could not load leads: {loadError}
        </p>
      )}

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
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
