import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { runCodDialerTick, runDialerTick, runLeadDialerTick } from "@/lib/dialer-runner";
import { runLeadDiscovery } from "@/lib/lead-monitor";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function readDiscoveryLimit(request: Request): number | null {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("discoveryLimit") ?? searchParams.get("limit");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

async function authorizeCron(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return unauthorized();
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not configured. Set CRON_SECRET in production or use npm run dialer:worker.",
      },
      { status: 503 },
    );
  }
  return null;
}

/**
 * Single cron entry point (Vercel Hobby: max 1 job, once per day — see vercel.json).
 * Runs NDR + COD + LEADS dialer ticks in one request.
 *
 * For frequent polling use npm run dialer:worker or an external cron hitting this URL.
 *
 * Optional query: ?discoveryLimit=20 — include lead-pool snapshot (no extra cron).
 *
 * GET or POST /api/cron/dialer
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const authError = await authorizeCron(request);
  if (authError) return authError;

  try {
    const discoveryLimit = readDiscoveryLimit(request);
    const [ndr, cod, leads, discovery] = await Promise.all([
      runDialerTick(),
      runCodDialerTick(),
      runLeadDialerTick(),
      discoveryLimit != null ? runLeadDiscovery(discoveryLimit) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      ok: true,
      ndr,
      cod,
      leads,
      ...(discovery != null ? { discovery } : {}),
    });
  } catch (err) {
    return apiErrorResponse(err, "Dialer cron failed");
  }
}
