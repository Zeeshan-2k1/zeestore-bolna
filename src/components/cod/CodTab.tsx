"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { SelectField } from "@/components/ui/SelectField";
import { CodShipmentStatuses } from "@/lib/constants";
import { formatStatusLabel } from "@/lib/format";
import type { ShipmentSortField } from "@/lib/shipment-query";
import { CodTable, type CodOrderRow } from "./CodTable";

type Props = {
  refreshKey: number;
  onRefresh: () => void;
};

type CodApi = {
  orders: CodOrderRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: string;
};

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function CodTab({ refreshKey, onRefresh }: Props) {
  const [rows, setRows] = useState<CodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<ShipmentSortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
      order,
    });
    if (searchDebounced) params.set("search", searchDebounced);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/cod/shipments?${params}`, { cache: "no-store" });
      const data = await parseJsonResponse<CodApi>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "Failed to load COD orders");
      }
      setRows(data.orders ?? []);
      if (data.pagination) {
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
      setLoadError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load COD orders";
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setLoadError(message);
      setToast({ type: "err", msg: message });
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, order, searchDebounced, statusFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  function handleSort(field: ShipmentSortField) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  }

  async function handleTriggerCall(id: string) {
    setTriggeringId(id);
    setToast(null);
    const res = await fetch(`/api/cod/${id}/trigger-call`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "err", msg: data.error ?? "Call failed" });
      setTriggeringId(null);
      return;
    }
    setToast({ type: "ok", msg: `COD call started · ${data.executionId?.slice(0, 8)}…` });
    setTriggeringId(null);
    await load();
    onRefresh();
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setPage(1);
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading COD orders…
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

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search order, user, phone…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-search"
              />
            </div>
            <SelectField
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {CodShipmentStatuses.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </SelectField>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 text-sm text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        </div>
      </div>

      <CodTable
        orders={rows}
        sort={sort}
        order={order}
        onSort={handleSort}
        onTriggerCall={handleTriggerCall}
        triggeringId={triggeringId}
      />
      {loadError && <p className="text-sm text-rose-600">Could not load COD orders: {loadError}</p>}

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

