# VoiceOps — D2C voice ops platform

Bolna-powered operations dashboard for Indian D2C brands: convert browsing traffic into orders, confirm COD before dispatch, and resolve failed deliveries (NDR) with structured voice outcomes.

## What it does

VoiceOps automates three outbound calling workflows from one Next.js app. Each workflow uses a dedicated Bolna agent; all calls share a single webhook that routes by stored call segment.

```
Shopify-style events → Lead scoring → LEADS call → Order (on CONVERSION)
                                              ↓
                                    COD confirmation call
                                              ↓
                              Failed delivery → NDR resolution call
```

| Segment | Purpose | Data model |
|---------|---------|------------|
| **LEADS** | Call high-intent visitors (cart abandon, checkout drop, product views) and convert them to orders | `User` + `Event` → `Order` on webhook `CONVERSION` |
| **COD** | Pre-delivery voice confirmation for cash-on-delivery orders | `Order` |
| **NDR** | Recover failed deliveries — reattempt, address fix, reschedule, or RTO | `Shipment` |

**Key behaviors**

- Orders are created **only** when a LEADS call completes with `outcome: CONVERSION` (not from payment/checkout events alone).
- Users who already completed checkout/payment events are excluded from the lead pool.
- COD failures (reject, wrong address, no answer) flow into the NDR queue as `Shipment` rows.
- Prepaid orders can simulate NDR failure after conversion (`PREPAID_NDR_*` env vars).
- One unified `Call` table tracks every Bolna execution with segment, outcome, transcript, and cost.

**UI routes**

| Route | Workspace |
|-------|-----------|
| `/` | Cross-segment dashboard, analytics, call log |
| `/leads` | Potential leads, scoring, manual/auto dialer |
| `/cod` | COD pending orders, confirmation calls |
| `/ndr` | NDR queue, shipment detail, CSV import |

---

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind)
- **Prisma** + **PostgreSQL** ([Neon](https://neon.tech), Supabase, Vercel Postgres, or local Docker)
- **[Bolna Voice API](https://platform.bolna.ai)** — three agents (LEADS, COD, NDR)

---

## Local setup

### Prerequisites

- Node.js 20+
- npm
- **Docker Desktop** (recommended for local Postgres) or a free [Neon](https://neon.tech) database
- [Bolna account](https://platform.bolna.ai) with API key and three outbound agents
- [ngrok](https://ngrok.com) (or similar) for Bolna webhooks during local dev

### 1. Clone and install

```bash
git clone <repo-url>
cd bolna-service-ops-agent
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` — minimum for local dev:

| Variable | Local value |
|----------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/voiceops?schema=public` (Docker) |
| `DIRECT_URL` | Same as `DATABASE_URL` for Docker; on Neon use the **direct** (non-pooler) URL |
| `PUBLIC_URL` | `http://localhost:3000` until ngrok is running (see step 7) |
| `BOLNA_API_KEY` | From Bolna dashboard |
| `BOLNA_AGENT_ID_LEADS` | LEADS agent ID |
| `BOLNA_AGENT_ID_COD` | COD agent ID |
| `BOLNA_AGENT_ID_NDR` | NDR agent ID |

**Bolna trial accounts:** set `BOLNA_VERIFIED_RECIPIENT_PHONE="+91XXXXXXXXXX"` so all outbound calls go to your verified number.

### 3. Database

**Option A — Local Docker (recommended)**

```bash
npm run db:up          # starts Postgres on localhost:5432
cp .env.example .env   # if not done already
npx prisma generate
npx prisma db push
npm run db:seed
```

**Option B — Neon / Supabase (no Docker)**

1. Create a project at [neon.tech](https://neon.tech) (or Supabase).
2. Copy the **pooled** connection string → `DATABASE_URL`
3. Copy the **direct** connection string → `DIRECT_URL` (required for `prisma db push` / Vercel build)
4. Run `npx prisma db push && npm run db:seed`

Seed creates sample users, products, events, orders, shipments, and calls. Open Prisma Studio anytime:

```bash
npm run db:studio
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Bolna agents

Create three agents in [Bolna platform](https://platform.bolna.ai):

| Segment | Env var | Prompt | Webhook tool config |
|---------|---------|--------|---------------------|
| LEADS | `BOLNA_AGENT_ID_LEADS` | [`docs/bolna-leads-agent-prompt.md`](./docs/bolna-leads-agent-prompt.md) | [`docs/bolna-leads-webhook-tool.json`](./docs/bolna-leads-webhook-tool.json) |
| COD | `BOLNA_AGENT_ID_COD` | [`docs/bolna-cod-agent-prompt.md`](./docs/bolna-cod-agent-prompt.md) | [`docs/bolna-cod-webhook-tool.json`](./docs/bolna-cod-webhook-tool.json) |
| NDR | `BOLNA_AGENT_ID_NDR` | [`docs/bolna-ndr-agent-prompt.md`](./docs/bolna-ndr-agent-prompt.md) | [`docs/bolna-ndr-webhook-tool.json`](./docs/bolna-ndr-webhook-tool.json) |

For each agent:

1. Paste the matching prompt.
2. Configure structured extraction / custom task per the webhook JSON (or prompt outcome schema).
3. Set webhook URL: `{PUBLIC_URL}/api/bolna-webhook` (same URL for all three).

The app selects the agent from `Call.segment` when placing outbound calls.

### 6. Webhooks locally (ngrok)

Bolna must reach your machine for post-call updates:

```bash
# Terminal 2 — while npm run dev is running
ngrok http 3000
```

Copy the **HTTPS** URL (e.g. `https://abc123.ngrok-free.app`), then update `.env`:

```env
PUBLIC_URL="https://abc123.ngrok-free.app"
```

Restart `npm run dev` and update the webhook URL in all three Bolna agents.

### 7. Auto-dialer (optional)

Dialing does not run in the browser. Enable **Automate** in the UI for a segment, then run the worker in a **second terminal**:

```bash
npm run dialer:worker
```

Polls every 5s and processes LEADS, COD, and NDR queues per `DialerSettings` in the DB.

Lead discovery only (prints top leads, no calls):

```bash
npm run leads:worker
```

---

## End-to-end local test flow

1. **Ingest events** — `POST /api/events/collect` with existing `userId` + `productId` (see seed data in Prisma Studio).
2. **Leads** — Open `/leads`, trigger a call or enable auto-dialer + worker.
3. **Webhook** — When Bolna finishes, it POSTs to `/api/bolna-webhook`. On `CONVERSION`, an `Order` is created.
4. **COD** — Open `/cod`, trigger confirmation on the new order.
5. **NDR** — Failed COD/prepaid paths create shipments; open `/ndr` and trigger resolution calls.

Dev-only simulate routes (no Bolna): `POST /api/shipments/:id/simulate`, `POST /api/cod/:id/simulate`.

---

## Tests

Integration tests use a separate Postgres database (`voiceops_test` via Docker) and **mock** Bolna API calls:

```bash
npm run db:up   # required before first test run
npm test
npm run test:watch
```

Tests do not require real Bolna credentials.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run db:up` | Start local Postgres (Docker Compose) |
| `npm run db:down` | Stop local Postgres |
| `npm run db:push` | Sync Prisma schema to DB |
| `npm run db:seed` | Seed users, products, events, orders, shipments |
| `npm run db:studio` | Prisma Studio |
| `npm run dialer:worker` | Background auto-dialer (LEADS + COD + NDR) |
| `npm run leads:worker` | Lead discovery monitor (no dialing) |
| `npm test` | Run flow tests |

---

## Environment reference

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled URL on Neon for runtime) |
| `DIRECT_URL` | Direct Postgres URL for Prisma migrate/push (Neon non-pooler); same as `DATABASE_URL` for Docker |
| `PUBLIC_URL` | Public app URL for Bolna webhooks |
| `BOLNA_API_KEY` | Bolna API key |
| `BOLNA_AGENT_ID_LEADS` / `_COD` / `_NDR` | Per-segment agent IDs |
| `BOLNA_AGENT_ID` | Optional fallback if a segment ID is omitted |
| `BOLNA_VERIFIED_RECIPIENT_PHONE` | Override recipient for trial accounts |
| `BOLNA_FROM_PHONE` | Optional caller ID (E.164) |
| `CRON_SECRET` | Bearer token for `/api/cron/dialer` in production |
| `EVENTS_API_KEY` | Optional auth for event ingest APIs |
| `PREPAID_NDR_FAILURE_RATE` | Simulated prepaid NDR rate (default `0.25`) |
| `PREPAID_NDR_MIN_FORCED_FAILURES` | First N prepaid orders always fail (default `5`) |

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bolna-webhook` | Bolna execution callbacks (all segments) |
| POST | `/api/events/collect` | Ingest user events (strict: known user + product) |
| GET | `/api/leads` | Potential leads list |
| POST | `/api/leads/:id/trigger-call` | Manual LEADS call |
| GET | `/api/cod/shipments` | COD order queue |
| POST | `/api/cod/:id/trigger-call` | Manual COD call |
| GET | `/api/shipments` | NDR shipment list |
| POST | `/api/shipments/:id/trigger-call` | Manual NDR call |
| POST | `/api/shipments/import` | CSV bulk import |
| GET | `/api/analytics` | Dashboard KPIs and charts |
| GET/POST | `/api/cron/dialer` | Cron dialer tick (`Authorization: Bearer CRON_SECRET`) |

---

## Deployment

**Vercel Hobby limits:** one cron job per account, and it may run **at most once per day**. This repo’s `vercel.json` uses `0 9 * * *` (09:00 UTC daily) as a light fallback tick — not suitable for high-frequency auto-dialing.

| Goal | Recommended approach |
|------|----------------------|
| **Frequent auto-dial (every ~5s)** | Run `npm run dialer:worker` on Railway, Render, Fly.io, or a VPS (same `DATABASE_URL` + Bolna env as the web app) |
| **External scheduler (free)** | [cron-job.org](https://cron-job.org) or similar → `GET https://your-app.vercel.app/api/cron/dialer` every 1–5 min with `Authorization: Bearer CRON_SECRET` |
| **Vercel-native cron every minute** | Upgrade to **Vercel Pro**, then set `vercel.json` schedule to e.g. `*/5 * * * *` |
| **Daily safety tick on Hobby** | Keep `vercel.json` as-is (`0 9 * * *`) + set `CRON_SECRET` |

The single route `/api/cron/dialer` runs **NDR + COD + LEADS** dialer ticks in one request. Optional lead snapshot: `?discoveryLimit=20`.

Use **Postgres** (`DATABASE_URL` + `DIRECT_URL`), set `PUBLIC_URL` to your deployment URL, and configure `CRON_SECRET`.

**Vercel + Neon checklist**

1. Create a Neon project → copy **pooled** URL to `DATABASE_URL`
2. Copy **direct** URL to `DIRECT_URL` (required for `prisma db push` during build)
3. Add both in Vercel → Settings → Environment Variables
4. Redeploy — `npm run build` runs `prisma db push` then `next build`
5. One-time: run `npm run db:seed` locally against prod URL, or seed via Prisma Studio

`/api/cron/leads` is **manual/debug only** — do not register a second Vercel Cron entry.

---
