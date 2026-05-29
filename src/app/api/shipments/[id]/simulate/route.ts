import { NextResponse } from "next/server";
import { CallOutcome, CallStatus, OpsSegment } from "@/lib/constants";
import { db } from "@/lib/db";
import { mapOutcomeToShipmentStatus } from "@/lib/ndr";

type Params = { params: Promise<{ id: string }> };

/** Dev-only: simulate webhook outcome when Bolna webhook isn't wired yet */
export async function POST(request: Request, { params }: Params) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const outcome = (body.outcome as string) ?? CallOutcome.REATTEMPT_CONFIRMED;

  const shipment = await db.shipment.findUnique({
    where: { id },
    include: { calls: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let call = shipment.calls[0];
  if (!call) {
    call = await db.call.create({
      data: {
        shipmentId: id,
        segment: OpsSegment.NDR,
        bolnaExecutionId: `sim-${Date.now()}`,
        status: CallStatus.COMPLETED,
        outcome,
        reason: body.reason ?? "Simulated for demo",
        selectedSlotId: body.selectedSlotId ?? "S1",
        transcript: body.transcript ?? "Agent: Namaste, delivery failed...\nCustomer: Kal subah theek hai.",
        startedAt: new Date(),
        endedAt: new Date(),
        durationSec: 45,
      },
    });
  } else {
    call = await db.call.update({
      where: { id: call.id },
      data: {
        status: CallStatus.COMPLETED,
        outcome,
        reason: body.reason ?? "Simulated for demo",
        selectedSlotId: body.selectedSlotId ?? "S1",
        transcript:
          body.transcript ??
          "Agent: Namaste, aapka order deliver nahi ho paya...\nCustomer: Kal 10-2 baje try karo.",
        endedAt: new Date(),
        durationSec: 45,
      },
    });
  }

  const shipmentStatus = mapOutcomeToShipmentStatus(
    outcome as (typeof CallOutcome)[keyof typeof CallOutcome],
  );

  await db.shipment.update({
    where: { id },
    data: { status: shipmentStatus, resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true, call });
}
