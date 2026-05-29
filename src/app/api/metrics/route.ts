import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeMetrics } from "@/lib/metrics";

export async function GET() {
  const shipments = await db.shipment.findMany({
    include: { calls: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(computeMetrics(shipments));
}
