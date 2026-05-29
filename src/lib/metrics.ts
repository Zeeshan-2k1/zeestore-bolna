import type { Call, Shipment } from "@prisma/client";
import { CallOutcome, ShipmentStatus } from "./constants";

type ShipmentWithCalls = Shipment & { calls: Call[] };

const RESOLVED_STATUSES = new Set<string>([
  ShipmentStatus.REATTEMPT_CONFIRMED,
  ShipmentStatus.RTO_CONFIRMED,
  ShipmentStatus.RESCHEDULED,
  ShipmentStatus.ADDRESS_UPDATED,
]);

export type DashboardMetrics = {
  totalNdr: number;
  pendingNdr: number;
  resolutionRate: number;
  reattemptRate: number;
  rtoRate: number;
  avgTimeToResolveHours: number | null;
  callsPlaced: number;
  callsCompleted: number;
};

export function computeMetrics(shipments: ShipmentWithCalls[]): DashboardMetrics {
  const totalNdr = shipments.length;
  const pendingNdr = shipments.filter(
    (s) => s.status === ShipmentStatus.NDR_PENDING || s.status === ShipmentStatus.CALL_IN_PROGRESS,
  ).length;

  const resolved = shipments.filter((s) => RESOLVED_STATUSES.has(s.status));
  const resolutionRate =
    totalNdr === 0 ? 0 : Math.round((resolved.length / totalNdr) * 100);

  const allCalls = shipments.flatMap((s) => s.calls);
  const completedCalls = allCalls.filter((c) => c.status === "COMPLETED");
  const callsPlaced = allCalls.length;
  const callsCompleted = completedCalls.length;

  const reattemptRate =
    callsCompleted === 0
      ? 0
      : Math.round(
          (completedCalls.filter((c) => c.outcome === CallOutcome.REATTEMPT_CONFIRMED)
            .length /
            callsCompleted) *
            100,
        );

  const rtoRate =
    callsCompleted === 0
      ? 0
      : Math.round(
          (completedCalls.filter((c) => c.outcome === CallOutcome.RTO_CONFIRMED).length /
            callsCompleted) *
            100,
        );

  const resolveTimes = resolved
    .filter((s) => s.resolvedAt)
    .map((s) => (s.resolvedAt!.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60));

  const avgTimeToResolveHours =
    resolveTimes.length === 0
      ? null
      : Math.round((resolveTimes.reduce((a, b) => a + b, 0) / resolveTimes.length) * 10) / 10;

  return {
    totalNdr,
    pendingNdr,
    resolutionRate,
    reattemptRate,
    rtoRate,
    avgTimeToResolveHours,
    callsPlaced,
    callsCompleted,
  };
}
