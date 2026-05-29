"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { KpiCards } from "./KpiCards";
import { ShipmentTable, type ShipmentRow } from "./ShipmentTable";
import { Pagination } from "./ui/Pagination";
import { SelectField } from "./ui/SelectField";
import type { DashboardMetrics } from "@/lib/metrics";
import type { ShipmentSortField } from "@/lib/shipment-query";
import { NdrReason, NdrShipmentStatuses } from "@/lib/constants";

type Props = {
  refreshKey: number;
  onRefresh: () => void;
};

export function QueueTab({ refreshKey, onRefresh }: Props) {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<ShipmentSortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ndrFilter, setNdrFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

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
    if (ndrFilter) params.set("ndrReason", ndrFilter);
    if (paymentFilter) params.set("paymentType", paymentFilter);

    const [shipRes, metRes] = await Promise.all([
      fetch(`/api/shipments?${params}`),
      fetch("/api/metrics"),
    ]);
    const shipData = await shipRes.json();
    const metData = await metRes.json();

    setShipments(shipData.shipments ?? []);
    if (shipData.pagination) {
      setTotal(shipData.pagination.total);
      setTotalPages(shipData.pagination.totalPages);
    }
    setMetrics(metData);
    setLoading(false);
  }, [
    page,
    limit,
    sort,
    order,
    searchDebounced,
    statusFilter,
    ndrFilter,
    paymentFilter,
  ]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  function handleSort(field: ShipmentSortField) {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  }

  async function handleTriggerCall(id: string) {
    setTriggeringId(id);
    setToast(null);

    const res = await fetch(`/api/shipments/${id}/trigger-call`, {
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
      msg: `Call started · ${data.executionId?.slice(0, 8)}…`,
    });
    setTriggeringId(null);
    await load();
    onRefresh();
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setNdrFilter("");
    setPaymentFilter("");
    setPage(1);
  }

  if (loading && shipments.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading NDR queue…
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

      {metrics && <KpiCards metrics={metrics} />}

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row items-center lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search AWB, order, phone…"
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
              {NdrShipmentStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </SelectField>
            <SelectField
              value={ndrFilter}
              onChange={(v) => {
                setNdrFilter(v);
                setPage(1);
              }}
              aria-label="Filter by NDR reason"
            >
              <option value="">All NDR reasons</option>
              {Object.values(NdrReason).map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </SelectField>
            <SelectField
              value={paymentFilter}
              onChange={(v) => {
                setPaymentFilter(v);
                setPage(1);
              }}
              aria-label="Filter by payment type"
            >
              <option value="">All payment types</option>
              <option value="COD">COD</option>
              <option value="PREPAID">Prepaid</option>
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

      <ShipmentTable
        shipments={shipments}
        sort={sort}
        order={order}
        onSort={handleSort}
        onTriggerCall={handleTriggerCall}
        triggeringId={triggeringId}
      />

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
