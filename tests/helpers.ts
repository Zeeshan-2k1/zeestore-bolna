import { PrismaClient } from "@prisma/client";
import {
  LeadCallOutcome,
  CodCallOutcome,
  CallOutcome,
  OpsSegment,
  PaymentType,
  ShipmentStatus,
  OrderStatus,
} from "../src/lib/constants";

export const testDb = new PrismaClient();

export async function resetDatabase() {
  await testDb.event.deleteMany();
  await testDb.call.deleteMany();
  await testDb.shipment.deleteMany();
  await testDb.order.deleteMany();
  await testDb.user.deleteMany();
  await testDb.product.deleteMany();
  await testDb.dialerSettings.deleteMany();
}

export async function seedBaseCatalog() {
  const product = await testDb.product.create({
    data: {
      sku: "SKU-FLOW-001",
      name: "Flow Test Sneakers",
      price: 1999,
      shopifyProductId: "gid://shopify/Product/flow-001",
    },
  });

  const leadUser = await testDb.user.create({
    data: {
      shopifyCustomerId: "shop_flow_lead",
      email: "lead.flow@example.com",
      phone: "+919811110001",
      firstName: "Lead",
      lastName: "Tester",
      address: "12 MG Road, Bengaluru",
      addressShort: "Bengaluru",
    },
  });

  const prepaidUser = await testDb.user.create({
    data: {
      shopifyCustomerId: "shop_flow_prepaid",
      email: "prepaid.flow@example.com",
      phone: "+919811110002",
      firstName: "Prepaid",
      lastName: "Tester",
      address: "45 Park Street, Kolkata",
      addressShort: "Kolkata",
    },
  });

  return { product, leadUser, prepaidUser };
}

export async function ingestLeadFunnelEvents(
  userId: string,
  productId: string,
  sku: string,
) {
  const names = ["page_viewed", "product_viewed", "add_to_cart", "checkout_started"];
  for (let i = 0; i < names.length; i += 1) {
    await testDb.event.create({
      data: {
        userId,
        productId,
        eventName: names[i],
        externalEventId: `flow-evt-${userId}-${i}`,
        occurredAt: new Date(),
        properties: JSON.stringify({ sku, product_id: productId }),
      },
    });
  }
}

export async function parseJson<T>(res: Response): Promise<{
  status: number;
  body: T;
}> {
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

export function bolnaWebhookBody(
  executionId: string,
  extracted: Record<string, unknown>,
  status = "completed",
) {
  return {
    id: executionId,
    execution_id: executionId,
    status,
    extracted_data: extracted,
  };
}

export const webhookPayloads = {
  leadsConversion: (executionId: string, paymentType: string) =>
    bolnaWebhookBody(executionId, {
      outcome: LeadCallOutcome.CONVERSION,
      payment_type: paymentType,
      order_amount: 1999,
      address: "12 MG Road, Bengaluru",
      address_short: "Bengaluru",
      product_sku: "SKU-FLOW-001",
      order_ref: `ORD-FLOW-${executionId}`,
    }),
  codConfirmed: (executionId: string) =>
    bolnaWebhookBody(executionId, {
      outcome: CodCallOutcome.COD_CONFIRMED,
      reason: "Customer confirmed COD delivery",
    }),
  codRejected: (executionId: string) =>
    bolnaWebhookBody(executionId, {
      outcome: CodCallOutcome.COD_REJECTED,
      reason: "Customer refused COD",
    }),
  ndrAddressUpdate: (executionId: string) =>
    bolnaWebhookBody(executionId, {
      outcome: CallOutcome.ADDRESS_UPDATE,
      address_update: "99 New Colony, Bengaluru",
      address_short: "Bengaluru",
      address_mode: "primary",
      reason: "Customer corrected address",
    }),
};

export { OpsSegment, PaymentType, ShipmentStatus, OrderStatus };
