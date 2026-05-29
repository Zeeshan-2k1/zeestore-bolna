import type { DashboardMetrics } from "@/lib/metrics";

type Props = { metrics: DashboardMetrics };

function KpiCard({
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function KpiCards({ metrics }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="NDR queue"
        value={String(metrics.pendingNdr)}
        sub={`${metrics.totalNdr} total shipments`}
      />
      <KpiCard
        label="Resolution rate"
        value={`${metrics.resolutionRate}%`}
        sub="Reattempt, RTO, reschedule, address fix"
      />
      <KpiCard
        label="Reattempt rate"
        value={`${metrics.reattemptRate}%`}
        sub={`${metrics.callsCompleted} completed calls`}
      />
      <KpiCard
        label="Avg resolve time"
        value={
          metrics.avgTimeToResolveHours != null
            ? `${metrics.avgTimeToResolveHours}h`
            : "—"
        }
        sub={`${metrics.callsPlaced} calls placed`}
      />
    </div>
  );
}
