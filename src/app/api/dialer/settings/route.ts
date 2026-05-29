import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { getOrCreateDialerSettings, toDialerDto } from "@/lib/dialer";
import { db } from "@/lib/db";
import { CallStatus, OpsSegment } from "@/lib/constants";
import { stringifyDialerFilters } from "@/lib/dialer-filters";
import type { NdrDialerFilters } from "@/lib/dialer-filters";

export async function GET() {
  try {
    const settings = await getOrCreateDialerSettings(OpsSegment.NDR);
    const activeCalls = await db.call.count({
      where: {
        segment: OpsSegment.NDR,
        status: { in: [CallStatus.QUEUED, CallStatus.IN_PROGRESS] },
      },
    });
    return NextResponse.json({
      settings: toDialerDto(settings),
      activeCalls,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load dialer settings");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (typeof body.batchSize === "number") {
      data.batchSize = Math.min(20, Math.max(1, body.batchSize));
    }
    if (typeof body.delayBetweenBatchesMs === "number") {
      data.delayBetweenBatchesMs = Math.min(
        600_000,
        Math.max(0, body.delayBetweenBatchesMs),
      );
    }
    if (typeof body.delayBetweenCallsMs === "number") {
      data.delayBetweenCallsMs = Math.min(
        60_000,
        Math.max(0, body.delayBetweenCallsMs),
      );
    }
    if (typeof body.filters === "object" && body.filters !== null) {
      const incoming = body.filters as Record<string, unknown>;
      const ndrFilters = (incoming.ndr ?? incoming) as NdrDialerFilters;
      data.filters = stringifyDialerFilters({
        ndr: ndrFilters,
      });
    }

    await getOrCreateDialerSettings(OpsSegment.NDR);
    const settings = await db.dialerSettings.update({
      where: { id: OpsSegment.NDR },
      data,
    });

    return NextResponse.json({ settings: toDialerDto(settings) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unknown argument `filters`")) {
      return NextResponse.json(
        {
          error:
            "Dialer settings schema is out of sync. Run `npx prisma db push --accept-data-loss && npx prisma generate`, then restart the dev server.",
        },
        { status: 409 },
      );
    }
    return apiErrorResponse(err, "Failed to update dialer settings");
  }
}
