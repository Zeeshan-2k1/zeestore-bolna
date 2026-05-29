"use client";

import { OpsSegment, type OpsSegmentValue } from "@/lib/constants";
import { PIPELINE_NAV, SEGMENT_ACCENT } from "@/lib/navigation";

export type DashboardFilterState = {
  segment: OpsSegmentValue | "ALL";
  period: "TODAY" | "LAST_7" | "LAST_14" | "LAST_30" | "LAST_90";
};

type Props = {
  filters: DashboardFilterState;
  onChange: (patch: Partial<DashboardFilterState>) => void;
};

const SEGMENT_OPTIONS: { value: DashboardFilterState["segment"]; label: string }[] =
  [
    { value: "ALL", label: "All segments" },
    ...PIPELINE_NAV.map((n) => ({ value: n.id, label: n.shortLabel })),
  ];

export function DashboardFilters({ filters, onChange }: Props) {
  const periodOptions: Array<{ value: DashboardFilterState["period"]; label: string }> = [
    { value: "TODAY", label: "Today" },
    { value: "LAST_7", label: "Last 7 days" },
    { value: "LAST_14", label: "Last 14 days" },
    { value: "LAST_30", label: "Last 30 days" },
    { value: "LAST_90", label: "Last 90 days" },
  ];

  return (
    <div className="card grid gap-5 p-5 lg:grid-cols-2">
      <div className="min-w-[200px]">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Segment</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SEGMENT_OPTIONS.map((opt) => {
            const active = filters.segment === opt.value;
            const accent =
              opt.value === "ALL"
                ? SEGMENT_ACCENT.dashboard
                : SEGMENT_ACCENT[opt.value as OpsSegmentValue];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ segment: opt.value })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? `${accent.badge} ring-2 ${accent.ring}`
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-[220px]">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {periodOptions.map((opt) => {
            const active = filters.period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ period: opt.value })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
