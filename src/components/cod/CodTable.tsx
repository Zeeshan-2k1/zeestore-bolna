"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Phone } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ShipmentStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { ShipmentSortField } from "@/lib/shipment-query";

export type CodOrderRow = {
  id: string;
  orderRef: string;
  awb: string;
  customerName: string;
  phone: string;
  email: string | null;
  productSummary: string;
  orderAmount: number;
  failureReason: string | null;
  status: string;
  expectedDeliveryDate: string;
  orderDate: string;
  lastCallAt?: string | null;
};

type Props = {
  orders: CodOrderRow[];
  sort: ShipmentSortField;
  order: "asc" | "desc";
  onSort: (field: ShipmentSortField) => void;
  onTriggerCall: (id: string) => Promise<void>;
  triggeringId: string | null;
};

function SortIcon({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
  return order === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 text-emerald-700" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-emerald-700" />
  );
}

export function CodTable({
  orders,
  sort,
  order,
  onSort,
  onTriggerCall,
  triggeringId,
}: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => onSort("deliveryDate")}
                  className="inline-flex items-center gap-1 font-semibold"
                >
                  Delivery date
                  <SortIcon active={sort === "deliveryDate"} order={order} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => onSort("createdAt")}
                  className="inline-flex items-center gap-1 font-semibold"
                >
                  Order date
                  <SortIcon active={sort === "createdAt"} order={order} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No COD orders found
                </td>
              </tr>
            ) : (
              orders.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{s.customerName}</p>
                    <p className="text-xs text-slate-500">{s.phone}</p>
                    <p className="text-xs text-slate-400">{s.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="text-slate-800 line-clamp-1">{s.productSummary}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {s.orderRef}
                      {s.awb ? ` · ${s.awb}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateTime(s.expectedDeliveryDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateTime(s.orderDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={toCodDisplayStatus(s.status, s.lastCallAt)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={
                        triggeringId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4" />
                        )
                      }
                      label="Call for COD confirmation"
                      variant="primary"
                      disabled={triggeringId === s.id}
                      onClick={() => void onTriggerCall(s.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toCodDisplayStatus(status: string, lastCallAt?: string | null): string {
  if (status === ShipmentStatus.COD_CONFIRMED) return "DELIVERED";
  if (lastCallAt) return "CALLED";
  return "NOT_CALLED";
}

