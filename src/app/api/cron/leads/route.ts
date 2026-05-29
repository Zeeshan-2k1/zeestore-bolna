import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { runLeadDiscovery } from "@/lib/lead-monitor";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function readLimit(request: Request): number {
  const { searchParams } = new URL(request.url);
  const raw = Number(searchParams.get("limit") ?? "20");
  if (!Number.isFinite(raw)) return 20;
  return Math.min(100, Math.max(1, Math.floor(raw)));
}

async function authorizeCron(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return unauthorized();
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  return null;
}

/**
 * Manual/debug lead-pool snapshot only — do NOT register as a second Vercel Cron
 * (Hobby allows one cron). Production scheduling: GET /api/cron/dialer?discoveryLimit=20
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
    const result = await runLeadDiscovery(readLimit(request));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return apiErrorResponse(err, "Lead cron failed");
  }
}
