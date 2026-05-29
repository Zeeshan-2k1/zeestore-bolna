---
name: project-memory
description: Quick orientation for Bolna service ops architecture and constraints
---

# Bolna Service Ops - Project Memory Skill

Use this skill at the start of a new chat when the task touches architecture, schema, or cross-segment refactors.

## Read First

1. `docs/agent-context.md`
2. `prisma/schema.prisma`
3. `src/lib/dialer.ts`
4. `src/lib/lead-dialer.ts`
5. `src/lib/cod-dialer.ts`
6. `src/app/api/bolna-webhook/route.ts`
7. `src/lib/event-ingest.ts` — strict collect API
8. `src/lib/order-from-lead.ts` — orders from LEADS conversion only
9. `src/lib/lead-query.ts` — excludes payment/checkout completion events

## Pipeline (short)

Events (collect) → lead score → LEADS call → Order on CONVERSION → COD or prepaid NDR sim → NDR recovery.

## Non-Negotiable Constraints

- Never modify `results/`.
- Chaos tests must use Toxiproxy (never kill Redis directly).
- Artillery scenarios must include `200` and `429` as expected status codes.
- Run baseline benchmark before algorithm benchmark.
- For `src/algorithms/` changes, ensure `compare.js` runs in CI.

## Implementation Style

- Prefer shared segment-aware abstractions.
- Keep segment wrappers thin (`lead`, `cod`, `ndr`).
- Avoid API contract changes unless explicitly requested.
- Validate with `npx tsc --noEmit` after substantial edits.
- If Prisma schema changed: run `db push`, `generate`, then restart dev server.
