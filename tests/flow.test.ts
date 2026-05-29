import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { POST as collectPost } from "@/app/api/events/collect/route";
import { POST as shopifyPost } from "@/app/api/events/shopify/route";
import { GET as leadsGet } from "@/app/api/leads/route";
import { POST as leadTriggerPost } from "@/app/api/leads/[id]/trigger-call/route";
import { POST as bolnaWebhookPost } from "@/app/api/bolna-webhook/route";
import { POST as codTriggerPost } from "@/app/api/cod/[id]/trigger-call/route";
import { POST as ndrTriggerPost } from "@/app/api/shipments/[id]/trigger-call/route";
import { GET as cronDialerGet } from "@/app/api/cron/dialer/route";
import { GET as cronLeadsGet } from "@/app/api/cron/leads/route";
import { POST as dialerProcessPost } from "@/app/api/dialer/process/route";
import { POST as leadDialerProcessPost } from "@/app/api/leads/dialer/process/route";
import { POST as codDialerProcessPost } from "@/app/api/cod/dialer/process/route";
import { GET as metricsGet } from "@/app/api/metrics/route";
import { GET as shipmentsGet } from "@/app/api/shipments/route";
import { GET as codShipmentsGet } from "@/app/api/cod/shipments/route";
import { resolveBolnaAgentId, assertBolnaConfigured } from "@/lib/env";
import { OpsSegment } from "@/lib/constants";
import { getBolnaFetchCalls } from "./bolna-mock";
import {
  testDb,
  resetDatabase,
  seedBaseCatalog,
  ingestLeadFunnelEvents,
  parseJson,
  webhookPayloads,
  OrderStatus,
  ShipmentStatus,
  PaymentType,
} from "./helpers";

async function seedDialerSettingsDisabled() {
  await testDb.dialerSettings.createMany({
    data: [
      { id: OpsSegment.NDR, segment: OpsSegment.NDR, enabled: false },
      { id: OpsSegment.LEADS, segment: OpsSegment.LEADS, enabled: false },
      { id: OpsSegment.COD, segment: OpsSegment.COD, enabled: false },
    ],
  });
}

describe("Bolna env configuration", () => {
  it("resolves segment agent IDs without error when vars are set", () => {
    expect(() => assertBolnaConfigured()).not.toThrow();
    expect(resolveBolnaAgentId(OpsSegment.LEADS)).toBe("test-agent-leads");
    expect(resolveBolnaAgentId(OpsSegment.COD)).toBe("test-agent-cod");
    expect(resolveBolnaAgentId(OpsSegment.NDR)).toBe("test-agent-ndr");
  });
});

describe("End-to-end ops flow (mocked Bolna)", () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedDialerSettingsDisabled();
  });

  it("ingests events via collect and shopify routes", async () => {
    const { product, leadUser } = await seedBaseCatalog();
    await ingestLeadFunnelEvents(leadUser.id, product.id, product.sku);

    const collectRes = await collectPost(
      new Request("http://localhost/api/events/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              event_name: "product_viewed",
              user_id: leadUser.id,
              sku: product.sku,
              event_id: "collect-1",
            },
          ],
        }),
      }),
    );
    const collect = await parseJson<{ ok: boolean; accepted: number }>(collectRes);
    expect(collect.status).toBe(201);
    expect(collect.body.accepted).toBe(1);

    const shopifyRes = await shopifyPost(
      new Request("http://localhost/api/events/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "add_to_cart",
          user_id: leadUser.id,
          sku: product.sku,
          event_id: "shopify-1",
        }),
      }),
    );
    expect(shopifyRes.status).toBe(201);
  });

  it("rejects ingest when user or product is missing", async () => {
    await seedBaseCatalog();
    const res = await collectPost(
      new Request("http://localhost/api/events/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [{ event_name: "page_viewed", user_id: "missing-user", sku: "SKU-FLOW-001" }],
        }),
      }),
    );
    const { body } = await parseJson<{ rejected: number }>(res);
    expect(body.rejected).toBe(1);
  });

  it("lists qualified leads and excludes payment-completed users", async () => {
    const { product, leadUser, prepaidUser } = await seedBaseCatalog();
    await ingestLeadFunnelEvents(leadUser.id, product.id, product.sku);
    await ingestLeadFunnelEvents(prepaidUser.id, product.id, product.sku);

    const leadsRes = await leadsGet(
      new Request("http://localhost/api/leads?limit=50"),
    );
    const { status, body } = await parseJson<{
      leads: Array<{ id: string }>;
    }>(leadsRes);
    expect(status).toBe(200);
    expect(body.leads.some((l) => l.id === leadUser.id)).toBe(true);

    await testDb.event.create({
      data: {
        userId: prepaidUser.id,
        productId: product.id,
        eventName: "payment_completed",
        externalEventId: "paid-1",
        occurredAt: new Date(),
      },
    });

    const afterPay = await leadsGet(new Request("http://localhost/api/leads?limit=50"));
    const afterBody = await parseJson<{ leads: Array<{ id: string }> }>(afterPay);
    expect(afterBody.body.leads.some((l) => l.id === prepaidUser.id)).toBe(false);
    expect(afterBody.body.leads.some((l) => l.id === leadUser.id)).toBe(true);
  });

  it("runs LEADS → COD → NDR pipeline with correct Bolna agents and DB updates", async () => {
    const { product, leadUser } = await seedBaseCatalog();
    await ingestLeadFunnelEvents(leadUser.id, product.id, product.sku);

    // LEADS call
    const leadTriggerRes = await leadTriggerPost(
      new Request("http://localhost"),
      { params: Promise.resolve({ id: leadUser.id }) },
    );
    const leadTrigger = await parseJson<{ executionId: string }>(leadTriggerRes);
    expect(leadTrigger.status).toBe(200);
    expect(
      getBolnaFetchCalls().some(
        (c) =>
          c.agentId === "test-agent-leads" &&
          c.workflowSegment === OpsSegment.LEADS,
      ),
    ).toBe(true);

    // LEADS webhook → Order
    await bolnaWebhookPost(
      new Request("http://localhost/api/bolna-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          webhookPayloads.leadsConversion(leadTrigger.body.executionId, PaymentType.COD),
        ),
      }),
    );

    const order = await testDb.order.findFirst({ where: { userId: leadUser.id } });
    expect(order?.paymentType).toBe(PaymentType.COD);
    expect(order?.status).toBe(OrderStatus.COD_PENDING);

    // COD call
    const codTriggerRes = await codTriggerPost(
      new Request("http://localhost"),
      { params: Promise.resolve({ id: order!.id }) },
    );
    const codTrigger = await parseJson<{ executionId: string }>(codTriggerRes);
    expect(codTrigger.status).toBe(200);
    expect(
      getBolnaFetchCalls().some(
        (c) => c.agentId === "test-agent-cod" && c.segment === OpsSegment.COD,
      ),
    ).toBe(true);

    // COD fail → NDR
    await bolnaWebhookPost(
      new Request("http://localhost/api/bolna-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayloads.codRejected(codTrigger.body.executionId)),
      }),
    );

    const failedOrder = await testDb.order.findUnique({ where: { id: order!.id } });
    expect(failedOrder?.status).toBe(OrderStatus.COD_CANCELLED);

    const shipment = await testDb.shipment.findFirst({
      where: { orderRowId: order!.id },
    });
    expect(shipment?.status).toBe(ShipmentStatus.NDR_PENDING);

    // NDR call
    const ndrTriggerRes = await ndrTriggerPost(
      new Request("http://localhost"),
      { params: Promise.resolve({ id: shipment!.id }) },
    );
    const ndrTrigger = await parseJson<{ executionId: string }>(ndrTriggerRes);
    expect(ndrTrigger.status).toBe(200);
    expect(
      getBolnaFetchCalls().some(
        (c) => c.agentId === "test-agent-ndr" && c.segment === OpsSegment.NDR,
      ),
    ).toBe(true);

    // NDR address update
    await bolnaWebhookPost(
      new Request("http://localhost/api/bolna-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayloads.ndrAddressUpdate(ndrTrigger.body.executionId)),
      }),
    );

    const updatedShipment = await testDb.shipment.findUnique({ where: { id: shipment!.id } });
    expect(updatedShipment?.address).toContain("New Colony");

    const updatedUser = await testDb.user.findUnique({ where: { id: leadUser.id } });
    expect(updatedUser?.address).toContain("New Colony");
  });

  it("PREPAID LEADS conversion creates simulated NDR shipment", async () => {
    const { product, prepaidUser } = await seedBaseCatalog();
    await ingestLeadFunnelEvents(prepaidUser.id, product.id, product.sku);

    const triggerRes = await leadTriggerPost(
      new Request("http://localhost"),
      { params: Promise.resolve({ id: prepaidUser.id }) },
    );
    const { body: trigger } = await parseJson<{ executionId: string }>(triggerRes);
    expect(triggerRes.status).toBe(200);

    await bolnaWebhookPost(
      new Request("http://localhost/api/bolna-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          webhookPayloads.leadsConversion(trigger.executionId, PaymentType.PREPAID),
        ),
      }),
    );

    const order = await testDb.order.findFirst({ where: { userId: prepaidUser.id } });
    expect(order?.paymentType).toBe(PaymentType.PREPAID);

    const ndrShipment = await testDb.shipment.findFirst({
      where: { orderRowId: order?.id },
    });
    expect(ndrShipment?.status).toBe(ShipmentStatus.NDR_PENDING);
    expect(ndrShipment?.paymentType).toBe(PaymentType.PREPAID);
  });

  it("COD confirmed webhook does not create NDR shipment", async () => {
    const { product, leadUser } = await seedBaseCatalog();
    const order = await testDb.order.create({
      data: {
        userId: leadUser.id,
        productId: product.id,
        orderRef: "ORD-CONFIRM-ONLY",
        productSummary: product.name,
        orderAmount: product.price,
        expectedDeliveryDate: new Date(Date.now() + 3 * 86400000),
        address: leadUser.address!,
        addressShort: leadUser.addressShort!,
        paymentType: PaymentType.COD,
        status: OrderStatus.COD_PENDING,
      },
    });

    const triggerRes = await codTriggerPost(
      new Request("http://localhost"),
      { params: Promise.resolve({ id: order.id }) },
    );
    const { body: trigger } = await parseJson<{ executionId: string }>(triggerRes);

    await bolnaWebhookPost(
      new Request("http://localhost/api/bolna-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayloads.codConfirmed(trigger.executionId)),
      }),
    );

    const updated = await testDb.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe(OrderStatus.COD_CONFIRMED);
    expect(await testDb.shipment.count({ where: { orderRowId: order.id } })).toBe(0);
  });
});

describe("Cron and dialer process routes", () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedBaseCatalog();
    await seedDialerSettingsDisabled();
  });

  const cronAuth = { authorization: "Bearer test-cron-secret" };

  it("cron dialer returns ok with disabled segment ticks", async () => {
    const res = await cronDialerGet(
      new Request("http://localhost/api/cron/dialer", { headers: cronAuth }),
    );
    const { status, body } = await parseJson<{
      ok: boolean;
      ndr: { ran: boolean };
      cod: { ran: boolean };
      leads: { ran: boolean };
    }>(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.ndr.ran).toBe(false);
    expect(body.cod.ran).toBe(false);
    expect(body.leads.ran).toBe(false);
  });

  it("cron dialer rejects wrong secret when CRON_SECRET is set", async () => {
    const res = await cronDialerGet(
      new Request("http://localhost/api/cron/dialer", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("cron leads discovery returns scored leads without error", async () => {
    const res = await cronLeadsGet(
      new Request("http://localhost/api/cron/leads?limit=10", { headers: cronAuth }),
    );
    const { status, body } = await parseJson<{ ok: boolean; result: unknown }>(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result).toBeDefined();
  });

  it("manual dialer process routes respond without server error", async () => {
    for (const handler of [dialerProcessPost, leadDialerProcessPost, codDialerProcessPost]) {
      const res = await handler();
      expect(res.status).toBeLessThan(500);
    }
  });
});

describe("Read APIs smoke (DB wired)", () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedBaseCatalog();
  });

  it("metrics, shipments, and cod list return 200", async () => {
    expect((await parseJson(await metricsGet())).status).toBe(200);
    expect(
      (await parseJson(await shipmentsGet(new Request("http://localhost/api/shipments"))))
        .status,
    ).toBe(200);
    expect(
      (await parseJson(await codShipmentsGet(new Request("http://localhost/api/cod/shipments"))))
        .status,
    ).toBe(200);
  });
});
