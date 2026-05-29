import type { Prisma } from "@prisma/client";
import { CallOutcome, CallStatus, OpsSegment } from "./constants";
import { db } from "./db";

export type CallLogSortField = "createdAt" | "durationSec";
export type SortOrder = "asc" | "desc";

export type CallLogQuery = {
  days: number;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
  sort: CallLogSortField;
  order: SortOrder;
  segment?: string;
  status?: string;
  trigger?: string;
  outcome?: string;
};

export type CallLogRow = {
  id: string;
  shipmentId: string;
  orderId: string;
  customerName: string;
  segment: string;
  status: string;
  outcome: string | null;
  triggerSource: string;
  failureCode: string | null;
  failureMessage: string | null;
  durationSec: number | null;
  costInr: number | null;
  createdAt: string;
};

export type CallLogResult = {
  rows: CallLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function sinceDate(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

export function buildCallLogWhere(query: CallLogQuery): Prisma.CallWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.startDate) {
    const d = new Date(query.startDate);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  } else {
    createdAt.gte = sinceDate(query.days);
  }
  if (query.endDate) {
    const d = new Date(query.endDate);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }
  const where: Prisma.CallWhereInput = { createdAt };

  if (query.segment && query.segment !== "ALL") {
    where.segment = query.segment;
  }

  if (query.status && query.status !== "ALL") {
    where.status = query.status;
  }

  if (query.trigger && query.trigger !== "ALL") {
    where.triggerSource = query.trigger;
  }

  if (query.outcome && query.outcome !== "ALL") {
    if (query.outcome === "API_FAILURE") {
      where.failureCode = { not: null };
    } else if (query.outcome === "PENDING") {
      where.outcome = null;
      where.failureCode = null;
    } else {
      where.outcome = query.outcome;
    }
  }

  return where;
}

export function parseCallLogQuery(
  searchParams: URLSearchParams,
): CallLogQuery {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );
  const days = Math.min(
    90,
    Math.max(1, parseInt(searchParams.get("days") ?? "14", 10) || 14),
  );

  const sortParam = searchParams.get("sort");
  const sort: CallLogSortField =
    sortParam === "durationSec" ? "durationSec" : "createdAt";

  const orderParam = searchParams.get("order");
  const order: SortOrder = orderParam === "asc" ? "asc" : "desc";

  return {
    days,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    page,
    limit,
    sort,
    order,
    segment: searchParams.get("segment") ?? "ALL",
    status: searchParams.get("status") ?? "ALL",
    trigger: searchParams.get("trigger") ?? "ALL",
    outcome: searchParams.get("outcome") ?? "ALL",
  };
}

export async function getCallLog(query: CallLogQuery): Promise<CallLogResult> {
  const where = buildCallLogWhere(query);
  const skip = (query.page - 1) * query.limit;

  const orderBy: Prisma.CallOrderByWithRelationInput =
    query.sort === "durationSec"
      ? { durationSec: query.order }
      : { createdAt: query.order };

  const [total, calls] = await Promise.all([
    db.call.count({ where }),
    db.call.findMany({
      where,
      skip,
      take: query.limit,
      orderBy,
      include: {
        shipment: {
          select: { orderId: true, customerName: true },
        },
        user: {
          select: { email: true, phone: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return {
    rows: calls.map((c) => ({
      id: c.id,
      shipmentId: c.shipmentId ?? "",
      orderId:
        c.shipment?.orderId ??
        (c.segment === OpsSegment.LEADS ? `LEAD-${c.userId?.slice(0, 6) ?? "NA"}` : "—"),
      customerName:
        c.shipment?.customerName ??
        ([c.user?.firstName, c.user?.lastName].filter(Boolean).join(" ") ||
          c.user?.phone ||
          c.user?.email ||
          "Unknown"),
      segment: c.segment || OpsSegment.NDR,
      status: c.status,
      outcome: c.outcome,
      triggerSource: c.triggerSource,
      failureCode: c.failureCode,
      failureMessage: c.failureCode ? c.reason : null,
      durationSec: c.durationSec,
      costInr: c.costInr,
      createdAt: c.createdAt.toISOString(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** Valid filter option values for API metadata */
export const CALL_LOG_FILTER_OPTIONS = {
  segments: ["ALL", OpsSegment.LEADS, OpsSegment.COD, OpsSegment.NDR],
  statuses: ["ALL", ...Object.values(CallStatus)],
  triggers: ["ALL", "MANUAL", "AUTOMATIC"],
  outcomes: [
    "ALL",
    "PENDING",
    "API_FAILURE",
    ...Object.values(CallOutcome),
  ],
} as const;
