"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Loader2, Phone } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { IconButton } from "./ui/IconButton";
import { NdrReasonCell } from "./NdrReasonCell";
import { formatDate, formatInr, formatTime } from "@/lib/format";
import { useShipmentNavigation } from "@/contexts/shipment-navigation";
import type { ShipmentSortField } from "@/lib/shipment-query";

export type ShipmentRow = {
  id: string;
  awb: string;
  orderId: string;
  customerName: string;
  phone: string;
  productSummary: string;
  orderAmount: number;
  paymentType: string;
  ndrReason: string;
  status: string;
  deliveryDate?: string;
  lastCallAt?: string | null;
  calls: { id: string; status: string; outcome: string | null }[];
};

type Props = {
  shipments: ShipmentRow[];
  sort: ShipmentSortField;
  order: "asc" | "desc";
  onSort: (field: ShipmentSortField) => void;
  onTriggerCall: (id: string) => Promise<void>;
  triggeringId: string | null;
};

const headerClass =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";

function SortIcon({
  field,
  sort,
  order,
}: {
  field: ShipmentSortField;
  sort: ShipmentSortField;
  order: "asc" | "desc";
}) {
  if (sort !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  return order === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
  );
}

function SortableHeader({
  label,
  field,
  sort,
  order,
  onSort,
  align = "left",
}: {
  label: string;
  field: ShipmentSortField;
  sort: ShipmentSortField;
  order: "asc" | "desc";
  onSort: (field: ShipmentSortField) => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 ${headerClass} hover:text-slate-800 ${
          align === "right" ? "ml-auto" : ""
        }`}
      >
        {label}
        <SortIcon field={field} sort={sort} order={order} />
      </button>
    </th>
  );
}

function DateTimeCell({ value }: { value?: string | null }) {
  if (!value) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="leading-tight">
      <p className="text-slate-800">{formatDate(value)}</p>
      <p className="text-xs text-slate-500">{formatTime(value)}</p>
    </div>
  );
}

function StaticHeader({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 ${headerClass} ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {label}
    </th>
  );
}

export function ShipmentTable({
  shipments,
  sort,
  order,
  onSort,
  onTriggerCall,
  triggeringId,
}: Props) {
  const { viewingShipmentId, navigateToShipment } = useShipmentNavigation();

  if (shipments.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-sm text-slate-500">No shipments match your filters.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80">
            <tr>
              <StaticHeader label="AWB / Order" />
              <StaticHeader label="Customer" />
              <SortableHeader
                label="Product"
                field="product"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              <StaticHeader label="NDR reason" />
              <StaticHeader label="Status" />
              <SortableHeader
                label="Delivery"
                field="deliveryDate"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              <StaticHeader label="Last call" />
              <StaticHeader label="Actions" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.map((s) => {
              const canCall =
                s.status === "NDR_PENDING" ||
                s.status === "NO_ANSWER" ||
                s.status === "RESCHEDULED";
              const isViewLoading = viewingShipmentId === s.id;

              return (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-slate-400">{s.awb}</p>
                    <p className="font-medium text-slate-900">{s.orderId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{s.customerName}</p>
                    <p className="text-xs text-slate-500">{s.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800 line-clamp-1">{s.productSummary}</p>
                    <p className="text-xs text-slate-500">
                      {formatInr(s.orderAmount)} · {s.paymentType}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <NdrReasonCell shipmentId={s.id} reasonCode={s.ndrReason} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <DateTimeCell value={s.deliveryDate} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <DateTimeCell value={s.lastCallAt} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={
                          isViewLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )
                        }
                        label="View details"
                        variant="ghost"
                        disabled={isViewLoading}
                        onClick={() => navigateToShipment(s.id)}
                      />
                      {canCall && (
                        <IconButton
                          icon={<Phone className="h-4 w-4" />}
                          label="Resolve via voice"
                          variant="primary"
                          disabled={triggeringId === s.id}
                          onClick={() => onTriggerCall(s.id)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
