import { listPotentialLeads, type LeadRow } from "./lead-query";

export type LeadDiscoveryResult = {
  totalPotential: number;
  hot: number;
  warm: number;
  cold: number;
  leads: LeadRow[];
};

export async function runLeadDiscovery(limit = 20): Promise<LeadDiscoveryResult> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const result = await listPotentialLeads({
    page: 1,
    limit: safeLimit,
    sort: "score",
    order: "desc",
  });

  return {
    totalPotential: result.summary.totalPotential,
    hot: result.summary.hot,
    warm: result.summary.warm,
    cold: result.summary.cold,
    leads: result.leads,
  };
}
