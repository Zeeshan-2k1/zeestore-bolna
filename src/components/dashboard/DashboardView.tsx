"use client";

import { useMemo, useState } from "react";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { PageHeader } from "@/components/layout/PageHeader";
import { OpsSegment } from "@/lib/constants";
import {
  DashboardFilters,
  type DashboardFilterState,
} from "./DashboardFilters";
import { SegmentOverviewCards } from "./SegmentOverviewCards";

export function DashboardView() {
  const [filters, setFilters] = useState<DashboardFilterState>({
    segment: "ALL",
    period: "LAST_14",
  });

  const showNdrAnalytics =
    filters.segment === "ALL" || filters.segment === OpsSegment.NDR;

  const filterPatch = useMemo(
    () => (patch: Partial<DashboardFilterState>) =>
      setFilters((prev) => ({ ...prev, ...patch })),
    [],
  );

  const periodDays = useMemo(() => {
    switch (filters.period) {
      case "TODAY":
        return 1;
      case "LAST_7":
        return 7;
      case "LAST_30":
        return 30;
      case "LAST_90":
        return 90;
      default:
        return 14;
    }
  }, [filters.period]);

  const dateRange = useMemo(() => {
    if (filters.period !== "TODAY") return { startDate: undefined, endDate: undefined };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [filters.period]);

  return (
    <div className="space-y-8">
      <PageHeader
        badge="D2C voice ops"
        title="Dashboard"
        description="End-to-end call analytics from lead conversion through NDR recovery. Use segment filters to focus each stage of the pipeline."
      />

      <DashboardFilters filters={filters} onChange={filterPatch} />

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Pipeline segments
        </h2>
        <SegmentOverviewCards
          highlightSegment={
            filters.segment === "ALL" ? "ALL" : filters.segment
          }
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Call analytics
            </h2>
            <p className="text-xs text-slate-500">
              {showNdrAnalytics
                ? "Showing NDR data today — other segments will appear here as they launch."
                : `${filters.segment.replace(/_/g, " ")} analytics will appear once this module is built.`}
            </p>
          </div>
        </div>

        {showNdrAnalytics ? (
          <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <AnalyticsTab
              key={`${filters.period}-${filters.segment}`}
              embedded
              days={periodDays}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              todayMode={filters.period === "TODAY"}
              segmentFilter={filters.segment}
            />
          </div>
        ) : (
          <div className="card flex min-h-[320px] flex-col items-center justify-center p-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              Analytics for this segment are not connected yet
            </p>
            <p className="mt-2 max-w-md text-xs text-slate-500">
              We will wire Bolna call logs, outcomes, and funnel metrics when the{" "}
              {filters.segment.toLowerCase()} workspace is implemented.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
