import type { Call, User } from "@prisma/client";
import {
  LeadCallOutcome,
  OrderStatus,
  PaymentType,
  type PaymentTypeValue,
} from "./constants";
import { db } from "./db";
import { applyPrepaidNdrSimulation } from "./prepaid-ndr-simulation";

export type LeadConversionExtracted = {
  outcome?: string;
  payment_type?: string;
  order_amount?: string | number;
  address?: string;
  address_short?: string;
  product_sku?: string;
  product_id?: string;
  order_ref?: string;
  expected_delivery_date?: string;
};

function parsePaymentType(value: unknown): PaymentTypeValue {
  const v = String(value ?? "").toUpperCase();
  return v === PaymentType.PREPAID ? PaymentType.PREPAID : PaymentType.COD;
}

function parseAmount(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseDeliveryDate(value: unknown): Date {
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d;
}

export function isLeadConversionOutcome(
  outcome: string | null | undefined,
): boolean {
  return outcome === LeadCallOutcome.CONVERSION;
}

export async function createOrderFromLeadConversion(
  call: Call & { user: User | null },
  extracted: LeadConversionExtracted,
): Promise<{ orderId: string; paymentType: PaymentTypeValue } | { error: string }> {
  if (!call.userId || !call.user) {
    return { error: "Lead call has no user" };
  }

  const user = call.user;
  const orderRef =
    (typeof extracted.order_ref === "string" && extracted.order_ref.trim()) ||
    `LEAD-${call.id.slice(0, 8)}-${user.id.slice(0, 6)}`;

  const existing = await db.order.findUnique({ where: { orderRef } });
  if (existing) {
    await db.call.update({
      where: { id: call.id },
      data: { orderId: existing.id },
    });
    return { orderId: existing.id, paymentType: existing.paymentType as PaymentTypeValue };
  }

  let product = null;
  if (typeof extracted.product_id === "string" && extracted.product_id.trim()) {
    product = await db.product.findUnique({
      where: { id: extracted.product_id.trim() },
    });
  }
  if (!product && typeof extracted.product_sku === "string" && extracted.product_sku.trim()) {
    product = await db.product.findUnique({
      where: { sku: extracted.product_sku.trim() },
    });
  }
  if (!product) {
    const recentEvent = await db.event.findFirst({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
      include: { product: true },
    });
    product = recentEvent?.product ?? null;
  }

  const productSummary = product?.name ?? "Product";
  const orderAmount = parseAmount(extracted.order_amount, product?.price ?? 999);
  const address =
    (typeof extracted.address === "string" && extracted.address.trim()) ||
    user.address ||
    "Address pending";
  const addressShort =
    (typeof extracted.address_short === "string" && extracted.address_short.trim()) ||
    user.addressShort ||
    address.slice(0, 40);
  const paymentType = parsePaymentType(extracted.payment_type);
  const expectedDeliveryDate = parseDeliveryDate(extracted.expected_delivery_date);

  const order = await db.order.create({
    data: {
      userId: user.id,
      productId: product?.id,
      orderRef,
      productSummary,
      orderAmount,
      expectedDeliveryDate,
      address,
      addressShort,
      paymentType,
      status: OrderStatus.COD_PENDING,
      languagePref: "hi-en",
      brandName: "QuickCart",
    },
  });

  await db.call.update({
    where: { id: call.id },
    data: { orderId: order.id },
  });

  if (!user.address && address !== "Address pending") {
    await db.user.update({
      where: { id: user.id },
      data: { address, addressShort },
    });
  }

  if (paymentType === PaymentType.PREPAID) {
    const orderWithUser = await db.order.findUnique({
      where: { id: order.id },
      include: { user: true },
    });
    if (orderWithUser) {
      await applyPrepaidNdrSimulation(orderWithUser);
    }
  }

  return { orderId: order.id, paymentType };
}

export function parseLeadConversionExtracted(
  data: Record<string, unknown> | null,
): LeadConversionExtracted {
  if (!data) return {};
  return {
    outcome: typeof data.outcome === "string" ? data.outcome : undefined,
    payment_type:
      typeof data.payment_type === "string" ? data.payment_type : undefined,
    order_amount: data.order_amount as string | number | undefined,
    address: typeof data.address === "string" ? data.address : undefined,
    address_short:
      typeof data.address_short === "string" ? data.address_short : undefined,
    product_sku:
      typeof data.product_sku === "string" ? data.product_sku : undefined,
    product_id:
      typeof data.product_id === "string" ? data.product_id : undefined,
    order_ref: typeof data.order_ref === "string" ? data.order_ref : undefined,
    expected_delivery_date:
      typeof data.expected_delivery_date === "string"
        ? data.expected_delivery_date
        : undefined,
  };
}
