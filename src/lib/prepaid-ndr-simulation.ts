import type { Order } from "@prisma/client";
import { NdrReason, PaymentType, ShipmentStatus, OrderStatus } from "./constants";
import { db } from "./db";

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getPrepaidNdrConfig() {
  return {
    failureRate: envFloat("PREPAID_NDR_FAILURE_RATE", 0.25),
    minForcedFailures: envInt("PREPAID_NDR_MIN_FORCED_FAILURES", 5),
  };
}

async function countPrepaidSimulatedFailures(): Promise<number> {
  return db.shipment.count({
    where: {
      paymentType: PaymentType.PREPAID,
      ndrReason: NdrReason.PREPAID_SIMULATED_FAILURE,
    },
  });
}

export async function shouldSimulatePrepaidNdrFailure(): Promise<boolean> {
  const { failureRate, minForcedFailures } = getPrepaidNdrConfig();
  const forcedCount = await countPrepaidSimulatedFailures();
  if (forcedCount < minForcedFailures) return true;
  return Math.random() < failureRate;
}

export async function applyPrepaidNdrSimulation(
  order: Order & { user?: { firstName: string | null; lastName: string | null; phone: string | null } | null },
): Promise<{ simulated: boolean; shipmentId?: string }> {
  const user =
    order.user ??
    (await db.user.findUnique({
      where: { id: order.userId },
      select: { firstName: true, lastName: true, phone: true },
    }));

  const fail = await shouldSimulatePrepaidNdrFailure();
  if (!fail) {
    await db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PREPAID_FULFILLED },
    });
    return { simulated: false };
  }

  const existing = await db.shipment.findFirst({
    where: { orderRowId: order.id },
  });
  if (existing) {
    return { simulated: true, shipmentId: existing.id };
  }

  const customerName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unknown";

  const shipment = await db.shipment.create({
    data: {
      awb:
        order.awb ??
        `NDR${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`,
      orderId: order.orderRef,
      orderRowId: order.id,
      customerName,
      phone: user?.phone ?? "",
      productSummary: order.productSummary,
      orderAmount: order.orderAmount,
      paymentType: PaymentType.PREPAID,
      address: order.address,
      addressShort: order.addressShort,
      ndrReason: NdrReason.PREPAID_SIMULATED_FAILURE,
      languagePref: order.languagePref,
      brandName: order.brandName,
      status: ShipmentStatus.NDR_PENDING,
      deliveryDate: order.expectedDeliveryDate,
    },
  });

  return { simulated: true, shipmentId: shipment.id };
}
