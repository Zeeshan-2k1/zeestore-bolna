"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Phone } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { LeadRow } from "@/lib/lead-query";

type LeadSortField = "score" | "lastActivityAt" | "createdAt";

type Props = {
  leads: LeadRow[];
  sort: LeadSortField;
  order: "asc" | "desc";
  onSort: (field: LeadSortField) => void;
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
    <ArrowUp className="h-3.5 w-3.5 text-sky-600" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-sky-600" />
  );
}

export function LeadTable({
  leads,
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
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => onSort("score")}
                  className="inline-flex items-center gap-1 font-semibold"
                >
                  Score
                  <SortIcon active={sort === "score"} order={order} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">Intent</th>
              <th className="px-4 py-3 text-left">Last event</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => onSort("lastActivityAt")}
                  className="inline-flex items-center gap-1 font-semibold"
                >
                  Last activity
                  <SortIcon active={sort === "lastActivityAt"} order={order} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No potential leads found
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="text-xs text-slate-400">
                      Created {formatDateTime(lead.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{lead.phone ?? "—"}</p>
                    <p className="text-xs text-slate-400">{lead.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {lead.score}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.intent} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {lead.lastEvent ? lead.lastEvent.replace(/_/g, " ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lead.lastActivityAt ? formatDateTime(lead.lastActivityAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={
                        triggeringId === lead.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4" />
                        )
                      }
                      label="Call lead"
                      variant="primary"
                      disabled={triggeringId === lead.id || !lead.phone}
                      onClick={() => void onTriggerCall(lead.id)}
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

