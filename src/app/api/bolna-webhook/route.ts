import { NextResponse } from "next/server";
import {
  extractCostInr,
  extractDurationSec,
  extractExecutionId,
  extractExtractedData,
  extractRecordingUrl,
  extractStatus,
  extractTranscript,
  type BolnaWebhookPayload,
} from "@/lib/bolna";
import {
  codFailureRequiresNdr,
  mapCodOutcomeToOrderStatus,
  mapCodReasonToNdrReason,
  parseCodCallOutcome,
} from "@/lib/cod-outcomes";
import {
  CallOutcome,
  CallStatus,
  LeadCallOutcome,
  OpsSegment,
  OrderStatus,
  ShipmentStatus,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { parseCallOutcome } from "@/lib/ndr";
import { applyNdrOutcomeWriteback } from "@/lib/ndr-writeback";
import {
  createOrderFromLeadConversion,
  isLeadConversionOutcome,
  parseLeadConversionExtracted,
} from "@/lib/order-from-lead";

function findSegmentOutcome(
  segment: string,
  data: Record<string, unknown> | null,
): string | null {
  if (!data) return null;

  if (segment === OpsSegment.LEADS) {
    const leadOutcomes = Object.values(LeadCallOutcome) as string[];
    if (typeof data.outcome === "string" && leadOutcomes.includes(data.outcome)) {
      return data.outcome;
    }
  }

  if (segment === OpsSegment.COD) {
    const cod = parseCodCallOutcome(data.outcome);
    if (cod) return cod;
  }

  const ndr = parseCallOutcome(data.outcome);
  if (ndr) return ndr;

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === "object" && val !== null) {
      const nested = (val as Record<string, unknown>).outcome;
      if (segment === OpsSegment.LEADS && typeof nested === "string") {
        const leadOutcomes = Object.values(LeadCallOutcome) as string[];
        if (leadOutcomes.includes(nested)) return nested;
      }
      if (segment === OpsSegment.COD) {
        const cod = parseCodCallOutcome(nested);
        if (cod) return cod;
      }
      const n = parseCallOutcome(nested);
      if (n) return n;
    }
  }

  return null;
}

async function upsertNdrFromCodOrder(
  order: {
    id: string;
    orderRef: string;
    awb: string | null;
    productSummary: string;
    orderAmount: number;
    paymentType: string;
    address: string;
    addressShort: string;
    languagePref: string;
    brandName: string;
    expectedDeliveryDate: Date;
    user: {
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
    } | null;
  },
  ndrReason: string,
) {
  const existing = await db.shipment.findFirst({
    where: { orderRowId: order.id },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await db.shipment.update({
      where: { id: existing.id },
      data: {
        ndrReason,
        status: ShipmentStatus.NDR_PENDING,
        deliveryDate: order.expectedDeliveryDate,
      },
    });
    return;
  }

  await db.shipment.create({
    data: {
      awb:
        order.awb ??
        `NDR${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`,
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

const LOG_PREFIX = "[bolna-webhook]";

function logWebhook(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(LOG_PREFIX, message, data);
  } else {
    console.log(LOG_PREFIX, message);
  }
}

export async function POST(request: Request) {
  let payload: BolnaWebhookPayload;

  try {
    payload = (await request.json()) as BolnaWebhookPayload;
  } catch {
    logWebhook("rejected: invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const executionId = extractExecutionId(payload);
  const bolnaStatus = extractStatus(payload);
  const extractedPreview = extractExtractedData(payload);

  logWebhook("received", {
    executionId: executionId ?? null,
    bolnaStatus,
    outcome: extractedPreview?.outcome ?? null,
    hasExtractedData: extractedPreview != null,
  });

  if (!executionId) {
    logWebhook("rejected: missing execution id");
    return NextResponse.json(
      { error: "Missing execution id in webhook payload" },
      { status: 400 },
    );
  }

  const call = await db.call.findUnique({
    where: { bolnaExecutionId: executionId },
    include: {
      shipment: true,
      order: { include: { user: true } },
      user: true,
    },
  });

  if (!call) {
    logWebhook("unmatched execution", { executionId });
    return NextResponse.json({ received: true, matched: false });
  }

  const status = bolnaStatus;
  const extracted = extractedPreview;
  const outcome = findSegmentOutcome(call.segment, extracted);
  const transcript = extractTranscript(payload);
  const recordingUrl = extractRecordingUrl(payload);
  const durationSec = extractDurationSec(payload);
  const costInr = extractCostInr(payload);

  const isTerminal =
    status === "completed" ||
    status === "failed" ||
    status === "no-answer" ||
    status === "busy";

  const callStatus = isTerminal
    ? status === "completed"
      ? CallStatus.COMPLETED
      : CallStatus.FAILED
    : CallStatus.IN_PROGRESS;

  logWebhook("matched call", {
    executionId,
    callId: call.id,
    segment: call.segment,
    bolnaStatus: status,
    callStatus,
    outcome: outcome ?? null,
    isTerminal,
    orderId: call.orderId,
    shipmentId: call.shipmentId,
    userId: call.userId,
  });

  await db.call.update({
    where: { id: call.id },
    data: {
      status: callStatus,
      outcome: outcome ?? undefined,
      selectedSlotId:
        typeof extracted?.selected_slot_id === "string"
          ? extracted.selected_slot_id
          : undefined,
      addressUpdate:
        typeof extracted?.address_update === "string"
          ? extracted.address_update
          : undefined,
      reason:
        typeof extracted?.reason === "string" ? extracted.reason : undefined,
      sentiment:
        typeof extracted?.sentiment === "string"
          ? extracted.sentiment
          : undefined,
      languageUsed:
        typeof extracted?.language_used === "string"
          ? extracted.language_used
          : undefined,
      transcript: transcript ?? undefined,
      recordingUrl: recordingUrl ?? undefined,
      durationSec: durationSec ?? undefined,
      costInr: costInr ?? undefined,
      endedAt: isTerminal ? new Date() : undefined,
    },
  });

  if (!isTerminal) {
    logWebhook("call updated (non-terminal)", { executionId, callId: call.id });
    return NextResponse.json({ received: true, matched: true, executionId });
  }

  if (call.segment === OpsSegment.LEADS && call.userId) {
    const leadExtracted = parseLeadConversionExtracted(extracted);
    const leadOutcome = outcome ?? leadExtracted.outcome ?? null;

    if (isLeadConversionOutcome(leadOutcome)) {
      const refreshed = await db.call.findUnique({
        where: { id: call.id },
        include: { user: true },
      });
      if (refreshed?.user) {
        const result = await createOrderFromLeadConversion(refreshed, {
          ...leadExtracted,
          outcome: LeadCallOutcome.CONVERSION,
        });
        logWebhook("LEADS conversion handled", {
          executionId,
          callId: call.id,
          userId: call.userId,
          leadOutcome,
          orderId: "orderId" in result ? result.orderId : null,
          paymentType: "paymentType" in result ? result.paymentType : null,
          error: "error" in result ? result.error : null,
        });
      }
    } else {
      logWebhook("LEADS terminal (no order created)", {
        executionId,
        callId: call.id,
        leadOutcome,
      });
    }
  } else if (call.segment === OpsSegment.NDR && call.shipmentId && call.shipment) {
    let order = call.order;
    if (!order && call.shipment.orderRowId) {
      order = await db.order.findUnique({
        where: { id: call.shipment.orderRowId },
        include: { user: true },
      });
    }

    let user = call.user ?? order?.user ?? null;
    if (!user && call.shipment.phone) {
      user = await db.user.findFirst({
        where: { phone: call.shipment.phone },
      });
    }

    if (outcome) {
      await applyNdrOutcomeWriteback({
        call: { ...call, outcome, addressUpdate: typeof extracted?.address_update === "string" ? extracted.address_update : call.addressUpdate },
        shipment: call.shipment,
        order,
        user,
        outcome,
        extracted,
      });
      logWebhook("NDR writeback applied", {
        executionId,
        callId: call.id,
        shipmentId: call.shipmentId,
        outcome,
      });
    } else {
      await db.shipment.update({
        where: { id: call.shipmentId },
        data: { status: ShipmentStatus.NO_ANSWER },
      });
      logWebhook("NDR no outcome — shipment NO_ANSWER", {
        executionId,
        shipmentId: call.shipmentId,
      });
    }
  } else if (call.segment === OpsSegment.COD && call.orderId && call.order) {
    const reason =
      typeof extracted?.reason === "string" ? extracted.reason : "Call not picked";
    const codOutcome = outcome ?? parseCodCallOutcome(extracted?.outcome);
    const nextStatus = mapCodOutcomeToOrderStatus(codOutcome, reason, status);
    const ndrReason = mapCodReasonToNdrReason(reason, status);

    await db.order.update({
      where: { id: call.orderId },
      data: {
        status: nextStatus,
        failureReason: nextStatus === OrderStatus.COD_CONFIRMED ? null : reason,
      },
    });

    if (codFailureRequiresNdr(nextStatus)) {
      await upsertNdrFromCodOrder(call.order, ndrReason);
    }

    logWebhook("COD order updated", {
      executionId,
      callId: call.id,
      orderId: call.orderId,
      codOutcome,
      nextOrderStatus: nextStatus,
      ndrCreated: codFailureRequiresNdr(nextStatus),
      ndrReason: codFailureRequiresNdr(nextStatus) ? ndrReason : null,
    });
  } else {
    logWebhook("terminal webhook — no segment action", {
      executionId,
      callId: call.id,
      segment: call.segment,
      outcome: outcome ?? null,
    });
  }

  logWebhook("completed", { executionId, callId: call.id, segment: call.segment });
  return NextResponse.json({ received: true, matched: true, executionId });
}
