import {
  isLeadExclusionEvent,
  OpenOrderStatusesForLeadExclusion,
  OpsSegment,
  ShopifyEventName,
  type LeadIntentValue,
} from "./constants";
import { db } from "./db";
import type { LeadDialerFilters } from "./dialer-filters";

type EventLite = {
  eventName: string;
  occurredAt: Date;
};

export type LeadSortField = "score" | "lastActivityAt" | "createdAt";
export type LeadOrder = "asc" | "desc";

export type LeadListParams = {
  page: number;
  limit: number;
  search?: string;
  intent?: string;
  sort: LeadSortField;
  order: LeadOrder;
};

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  score: number;
  intent: LeadIntentValue;
  lastEvent: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  recentCallAt: string | null;
};

export type LeadListResult = {
  leads: LeadRow[];
  summary: {
    totalPotential: number;
    hot: number;
    warm: number;
    cold: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ScoredLeadTarget = { id: string; score: number };

const SCORE_MAP: Record<string, number> = {
  [ShopifyEventName.PAGE_VIEWED]: 2,
  [ShopifyEventName.PRODUCT_VIEWED]: 8,
  [ShopifyEventName.SEARCH_SUBMITTED]: 5,
  [ShopifyEventName.ADD_TO_CART]: 30,
  [ShopifyEventName.CHECKOUT_STARTED]: 40,
  [ShopifyEventName.CHECKOUT_COMPLETED]: 80,
};

function intentFromScore(score: number): LeadIntentValue {
  if (score >= 80) return "HOT";
  if (score >= 45) return "WARM";
  return "COLD";
}

function computeLeadScore(events: EventLite[]) {
  let score = 0;
  let alreadyConverted = false;
  let lastEvent: string | null = null;
  let lastActivityAt: Date | null = null;

  for (const e of events) {
    const eventName = e.eventName.toLowerCase();
    if (isLeadExclusionEvent(eventName)) {
      alreadyConverted = true;
    }
    score += SCORE_MAP[eventName] ?? 0;
    if (!lastActivityAt || e.occurredAt > lastActivityAt) {
      lastActivityAt = e.occurredAt;
      lastEvent = eventName;
    }
  }

  return { score, alreadyConverted, lastEvent, lastActivityAt };
}

export function parseLeadListParams(searchParams: URLSearchParams): LeadListParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(5, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );
  const sortParam = searchParams.get("sort");
  const sort: LeadSortField =
    sortParam === "createdAt" || sortParam === "lastActivityAt"
      ? sortParam
      : "score";
  const order: LeadOrder = searchParams.get("order") === "asc" ? "asc" : "desc";

  return {
    page,
    limit,
    sort,
    order,
    search: searchParams.get("search")?.trim() || undefined,
    intent: searchParams.get("intent") || undefined,
  };
}

export async function getPotentialLeadIds(
  limit: number,
  filters?: LeadDialerFilters,
): Promise<ScoredLeadTarget[]> {
  const data = await buildPotentialLeads(filters);
  return data
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({ id: x.id, score: x.score }));
}

export async function listPotentialLeads(
  params: LeadListParams,
): Promise<LeadListResult> {
  const rows = await buildPotentialLeads();

  const filtered = rows.filter((row) => {
    if (params.intent && params.intent !== "ALL" && row.intent !== params.intent) {
      return false;
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      const hay = `${row.name} ${row.email ?? ""} ${row.phone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = filtered.sort((a, b) => {
    const dir = params.order === "asc" ? 1 : -1;
    if (params.sort === "score") return (a.score - b.score) * dir;
    if (params.sort === "createdAt") {
      return (
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      );
    }
    return (
      ((a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0) -
        (b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0)) * dir
    );
  });

  const start = (params.page - 1) * params.limit;
  const pageRows = sorted.slice(start, start + params.limit);

  const summary = {
    totalPotential: filtered.length,
    hot: filtered.filter((r) => r.intent === "HOT").length,
    warm: filtered.filter((r) => r.intent === "WARM").length,
    cold: filtered.filter((r) => r.intent === "COLD").length,
  };

  return {
    leads: pageRows,
    summary,
    pagination: {
      page: params.page,
      limit: params.limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / params.limit)),
    },
  };
}

async function buildPotentialLeads(filters?: LeadDialerFilters): Promise<LeadRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const users = await db.user.findMany({
    where: {
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    include: {
      events: {
        where: { occurredAt: { gte: since } },
        select: { eventName: true, occurredAt: true },
      },
      orders: {
        where: { status: { in: [...OpenOrderStatusesForLeadExclusion] } },
        select: { id: true },
        take: 1,
      },
      calls: {
        where: { segment: OpsSegment.LEADS },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const out: LeadRow[] = [];

  for (const u of users) {
    const { score, alreadyConverted, lastEvent, lastActivityAt } = computeLeadScore(
      u.events.map((e) => ({ eventName: e.eventName, occurredAt: e.occurredAt })),
    );

    if (alreadyConverted || u.orders.length > 0) continue;
    if (score < 25 || (!u.phone && !u.email)) continue;
    if (filters?.score && !matchNumeric(score, filters.score)) continue;

    const intent = intentFromScore(score);
    if (filters?.intent) {
      const matchesIntent = intent === filters.intent.value;
      if (
        (filters.intent.op === "eq" && !matchesIntent) ||
        (filters.intent.op === "neq" && matchesIntent)
      ) {
        continue;
      }
    }

    if (filters?.lastEvent && !matchLastEvent(lastEvent, filters.lastEvent)) continue;
    if (filters?.date && lastActivityAt) {
      const target = new Date(filters.date.value).getTime();
      const observed = lastActivityAt.getTime();
      if (filters.date.op === "gt" && !(observed > target)) continue;
      if (filters.date.op === "lt" && !(observed < target)) continue;
    }

    out.push({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown user",
      email: u.email,
      phone: u.phone,
      score,
      intent,
      lastEvent,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      recentCallAt: u.calls[0]?.createdAt.toISOString() ?? null,
    });
  }

  return out;
}

function matchNumeric(
  value: number,
  filter: { op: "gt" | "lt" | "eq"; value: number },
) {
  if (filter.op === "gt") return value > filter.value;
  if (filter.op === "lt") return value < filter.value;
  return value === filter.value;
}

function matchLastEvent(
  lastEvent: string | null,
  filter: { op: "in" | "not_in" | "eq"; values: string[] },
) {
  if (!lastEvent) return false;
  if (filter.op === "eq") return filter.values[0] === lastEvent;
  if (filter.op === "in") return filter.values.includes(lastEvent);
  return !filter.values.includes(lastEvent);
}
