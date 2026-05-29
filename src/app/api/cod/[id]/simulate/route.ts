import { NextResponse } from "next/server";
import {
  codFailureRequiresNdr,
  mapCodOutcomeToOrderStatus,
  mapCodReasonToNdrReason,
} from "@/lib/cod-outcomes";
import { CallStatus, CodCallOutcome, OpsSegment, ShipmentStatus } from "@/lib/constants";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Dev-only: simulate COD Bolna webhook outcome */
export async function POST(request: Request, { params }: Params) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    outcome?: string;
    reason?: string;
    status?: string;
  };

  const outcome = body.outcome ?? CodCallOutcome.COD_CONFIRMED;
  const reason = body.reason ?? "Simulated for demo";
  const callStatus = body.status ?? "completed";

  const order = await db.order.findUnique({
    where: { id },
    include: { user: true, calls: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let call = order.calls[0];
  if (!call) {
    call = await db.call.create({
      data: {
        orderId: id,
        segment: OpsSegment.COD,
        bolnaExecutionId: `sim-cod-${Date.now()}`,
        status: CallStatus.COMPLETED,
        outcome,
        reason,
        startedAt: new Date(),
        endedAt: new Date(),
        durationSec: 40,
      },
    });
  } else {
    call = await db.call.update({
      where: { id: call.id },
      data: {
        status: CallStatus.COMPLETED,
        outcome,
        reason,
        endedAt: new Date(),
        durationSec: 40,
      },
    });
  }

  const nextStatus = mapCodOutcomeToOrderStatus(outcome, reason, callStatus);
  await db.order.update({
    where: { id },
    data: {
      status: nextStatus,
      failureReason: nextStatus === "COD_CONFIRMED" ? null : reason,
    },
  });

  if (codFailureRequiresNdr(nextStatus)) {
    const ndrReason = mapCodReasonToNdrReason(reason, callStatus);
    const existing = await db.shipment.findFirst({ where: { orderRowId: id } });
    if (existing) {
      await db.shipment.update({
        where: { id: existing.id },
        data: { ndrReason, status: ShipmentStatus.NDR_PENDING },
      });
    } else {
      await db.shipment.create({
        data: {
          awb: `NDR${Date.now().toString().slice(-8)}`,
          orderId: order.orderRef,
          orderRowId: order.id,
          customerName:
            [order.user?.firstName, order.user?.lastName].filter(Boolean).join(" ") ||
            "Unknown",
          phone: order.user?.phone ?? "",
          productSummary: order.productSummary,
          orderAmount: order.orderAmount,
          paymentType: order.paymentType,
          address: order.address,
          addressShort: order.addressShort,
          ndrReason,
          languagePref: order.languagePref,
          brandName: order.brandName,
          status: ShipmentStatus.NDR_PENDING,
          deliveryDate: order.expectedDeliveryDate,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, call, orderStatus: nextStatus });
}
