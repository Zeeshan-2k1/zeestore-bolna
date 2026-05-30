import { PrismaClient } from "@prisma/client";
import {
  CallOutcome,
  CallStatus,
  CallTriggerSource,
  CodCallOutcome,
  LeadCallOutcome,
  NdrReason,
  NdrShipmentStatuses,
  OpsSegment,
  OrderStatus,
  PaymentType,
  ShopifyEventName,
  ShipmentStatus,
} from "../src/lib/constants";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Ramesh",
  "Sneha",
  "Asif",
  "Priya",
  "Vikram",
  "Neha",
  "Aman",
  "Isha",
  "Rahul",
  "Kavya",
  "Imran",
  "Pooja",
  "Deepak",
  "Ananya",
  "Farhan",
  "Meera",
];
const LAST_NAMES = [
  "Kumar",
  "Menon",
  "Rahman",
  "Nair",
  "Singh",
  "Sharma",
  "Patel",
  "Joshi",
  "Verma",
  "Iyer",
  "Gupta",
  "Reddy",
];
const CITIES = ["Bengaluru", "Hyderabad", "Noida", "Pune", "Mumbai", "Chennai"];
const PRODUCT_CATALOG = [
  { sku: "SKU-SHOES-001", name: "Running shoes", price: 2499 },
  { sku: "SKU-SPK-002", name: "Bluetooth speaker", price: 1999 },
  { sku: "SKU-MIX-003", name: "Kitchen mixer", price: 3499 },
  { sku: "SKU-KURTA-004", name: "Cotton kurta set", price: 1299 },
  { sku: "SKU-BAG-005", name: "Laptop backpack", price: 1799 },
  { sku: "SKU-CASE-006", name: "Phone case", price: 499 },
];
const EVENT_SOURCES = ["CLIENT", "SERVER"] as const;
const LEAD_EVENTS = [
  ShopifyEventName.PAGE_VIEWED,
  ShopifyEventName.PRODUCT_VIEWED,
  ShopifyEventName.SEARCH_SUBMITTED,
  ShopifyEventName.ADD_TO_CART,
  ShopifyEventName.CHECKOUT_STARTED,
];
const NDR_REASONS = Object.values(NdrReason);
const COD_ORDER_STATUSES = [
  OrderStatus.COD_PENDING,
  OrderStatus.COD_CONFIRMED,
  OrderStatus.COD_CALLBACK,
  OrderStatus.COD_CANCELLED,
  OrderStatus.COD_INVALID_ADDRESS,
  OrderStatus.COD_UNREACHABLE,
] as const;
const COD_CALL_OUTCOMES = Object.values(CodCallOutcome);
const CALL_STATUSES = Object.values(CallStatus);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function maybe<T>(value: T, probability = 0.5): T | undefined {
  return Math.random() < probability ? value : undefined;
}

function randomPhone(seed: number) {
  return `+9198${String(10000000 + seed).slice(-8)}`;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}

function parseIntFlag(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const v = Number(raw.split("=")[1]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

async function ensureDialerSettings() {
  for (const segment of [OpsSegment.NDR, OpsSegment.LEADS, OpsSegment.COD]) {
    await prisma.dialerSettings.upsert({
      where: { id: segment },
      update: {},
      create: { id: segment, segment, enabled: false },
    });
  }
}

async function seedProducts() {
  const products = [];
  for (const p of PRODUCT_CATALOG) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        price: p.price,
        shopifyProductId: `gid://shopify/Product/${p.sku}`,
      },
    });
    products.push(product);
  }
  return products;
}

type SeededUser = Awaited<ReturnType<typeof prisma.user.create>>;
type SeededProduct = Awaited<ReturnType<typeof prisma.product.create>>;
type SeededOrder = Awaited<ReturnType<typeof prisma.order.create>>;

async function seedUsers(count: number): Promise<SeededUser[]> {
  const users: SeededUser[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = pickOne(FIRST_NAMES);
    const last = pickOne(LAST_NAMES);
    const city = pickOne(CITIES);
    users.push(
      await prisma.user.create({
        data: {
          shopifyCustomerId: `shop_seed_${i}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
          phone: randomPhone(i),
          firstName: first,
          lastName: last,
          address: `${randInt(1, 99)}, ${city} Main Road, ${city}`,
          addressShort: city,
          secondaryAddress: maybe(`${randInt(1, 50)}, ${city} Side Lane`, 0.25),
          secondaryPhone: maybe(randomPhone(20000 + i), 0.2),
          source: "SHOPIFY",
        },
      }),
    );
  }
  return users;
}

async function seedLeadEventsAndCalls(
  users: SeededUser[],
  products: SeededProduct[],
  eventsPerUser: number,
) {
  for (let i = 0; i < users.length; i += 1) {
    const user = users[i];
    const product = pickOne(products);

    for (let j = 0; j < eventsPerUser; j += 1) {
      await prisma.event.create({
        data: {
          userId: user.id,
          productId: product.id,
          platform: "SHOPIFY",
          source: pickOne([...EVENT_SOURCES]),
          eventName: pickOne(LEAD_EVENTS),
          externalEventId: `evt_seed_${user.id}_${j}`,
          occurredAt: daysAgo(randInt(0, 14)),
          properties: JSON.stringify({
            page: pickOne(["home", "product", "checkout"]),
            cart_value: randInt(500, 10000),
            sku: product.sku,
          }),
        },
      });
    }

    if (i % 3 === 0) {
      await prisma.call.create({
        data: {
          userId: user.id,
          segment: OpsSegment.LEADS,
          triggerSource: pickOne([
            CallTriggerSource.MANUAL,
            CallTriggerSource.AUTOMATIC,
          ]),
          status: CallStatus.COMPLETED,
          outcome: pickOne(Object.values(LeadCallOutcome)),
          sentiment: pickOne(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
          durationSec: randInt(30, 280),
          costInr: randInt(3, 18),
          createdAt: daysAgo(randInt(1, 10)),
        },
      });
    }
  }
}

function failureReasonForOrderStatus(status: string): string | null {
  switch (status) {
    case OrderStatus.COD_INVALID_ADDRESS:
      return CodCallOutcome.WRONG_ADDRESS;
    case OrderStatus.COD_CANCELLED:
      return CodCallOutcome.COD_REJECTED;
    case OrderStatus.COD_UNREACHABLE:
      return CodCallOutcome.NO_ANSWER;
    case OrderStatus.COD_CALLBACK:
      return CodCallOutcome.CALLBACK;
    default:
      return null;
  }
}

async function seedCodOrders(
  users: SeededUser[],
  products: SeededProduct[],
  perStatus: number,
): Promise<SeededOrder[]> {
  const orders: SeededOrder[] = [];
  let seq = 10001;

  for (const status of COD_ORDER_STATUSES) {
    for (let i = 0; i < perStatus; i += 1) {
      const user = pickOne(users);
      const product = pickOne(products);
      const city = user.addressShort ?? pickOne(CITIES);
      const orderRef = `ORD-${seq}`;
      seq += 1;

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          productId: product.id,
          orderRef,
          awb: maybe(`AWB${orderRef}`, 0.6),
          productSummary: `${product.name} (${pickOne(["S", "M", "L", "XL"])})`,
          orderAmount: product.price,
          expectedDeliveryDate: daysFromNow(randInt(1, 5)),
          orderDate: daysAgo(randInt(0, 7)),
          address: user.address ?? `${randInt(1, 99)}, ${city} Main Road`,
          addressShort: city,
          paymentType: PaymentType.COD,
          status,
          failureReason: failureReasonForOrderStatus(status),
          languagePref: pickOne(["hi-en", "hi", "en"]),
          brandName: "ZeeStore",
        },
      });
      orders.push(order);

      if (status === OrderStatus.COD_CONFIRMED) {
        await prisma.call.create({
          data: {
            orderId: order.id,
            segment: OpsSegment.COD,
            triggerSource: pickOne([
              CallTriggerSource.MANUAL,
              CallTriggerSource.AUTOMATIC,
            ]),
            status: CallStatus.COMPLETED,
            outcome: CodCallOutcome.COD_CONFIRMED,
            reason: "Customer confirmed COD order",
            sentiment: "POSITIVE",
            durationSec: randInt(45, 180),
            costInr: randInt(4, 12),
            transcript: "Customer confirmed delivery address and COD amount.",
            createdAt: daysAgo(randInt(1, 5)),
            endedAt: daysAgo(randInt(0, 4)),
          },
        });
      } else if (
        status === OrderStatus.COD_PENDING ||
        status === OrderStatus.COD_CALLBACK ||
        status === OrderStatus.COD_UNREACHABLE
      ) {
        if (Math.random() < 0.35) {
          await prisma.call.create({
            data: {
              orderId: order.id,
              segment: OpsSegment.COD,
              triggerSource: CallTriggerSource.MANUAL,
              status: pickOne([CallStatus.COMPLETED, CallStatus.FAILED]),
              outcome:
                status === OrderStatus.COD_PENDING
                  ? maybe(CodCallOutcome.NO_ANSWER, 0.5)
                  : CodCallOutcome.NO_ANSWER,
              reason: "Previous attempt — no answer",
              durationSec: maybe(randInt(5, 30), 0.7),
              costInr: maybe(randInt(2, 8), 0.7),
              createdAt: daysAgo(randInt(0, 3)),
            },
          });
        }
      } else if (
        status === OrderStatus.COD_CANCELLED ||
        status === OrderStatus.COD_INVALID_ADDRESS
      ) {
        await prisma.call.create({
          data: {
            orderId: order.id,
            segment: OpsSegment.COD,
            triggerSource: CallTriggerSource.MANUAL,
            status: CallStatus.COMPLETED,
            outcome:
              status === OrderStatus.COD_INVALID_ADDRESS
                ? CodCallOutcome.WRONG_ADDRESS
                : CodCallOutcome.COD_REJECTED,
            reason: order.failureReason ?? "COD call failed",
            sentiment: pickOne(["NEUTRAL", "NEGATIVE"]),
            durationSec: randInt(40, 200),
            costInr: randInt(4, 14),
            createdAt: daysAgo(randInt(1, 6)),
          },
        });
      }
    }
  }

  for (let i = 0; i < perStatus; i += 1) {
    const user = pickOne(users);
    const product = pickOne(products);
    orders.push(
      await prisma.order.create({
        data: {
          userId: user.id,
          productId: product.id,
          orderRef: `ORD-PRE-${10001 + i}`,
          productSummary: `${product.name} (PREPAID)`,
          orderAmount: product.price,
          expectedDeliveryDate: daysFromNow(randInt(1, 4)),
          orderDate: daysAgo(randInt(0, 5)),
          address: user.address ?? "Prepaid address",
          addressShort: user.addressShort ?? pickOne(CITIES),
          paymentType: PaymentType.PREPAID,
          status: OrderStatus.PREPAID_FULFILLED,
          brandName: "ZeeStore",
        },
      }),
    );
  }

  return orders;
}

async function seedNdrShipments(
  users: SeededUser[],
  orders: SeededOrder[],
  perStatus: number,
) {
  const failedCodOrders = orders.filter(
    (o) =>
      o.paymentType === PaymentType.COD &&
      (o.status === OrderStatus.COD_CANCELLED ||
        o.status === OrderStatus.COD_INVALID_ADDRESS ||
        o.status === OrderStatus.COD_UNREACHABLE),
  );

  let standaloneSeq = 20001;

  for (const status of NdrShipmentStatuses) {
    for (let i = 0; i < perStatus; i += 1) {
      const linkOrder = failedCodOrders.length > 0 && i % 2 === 0;
      const order = linkOrder ? pickOne(failedCodOrders) : null;
      const user = order
        ? users.find((u) => u.id === order.userId) ?? pickOne(users)
        : pickOne(users);
      const first = user.firstName ?? pickOne(FIRST_NAMES);
      const last = user.lastName ?? pickOne(LAST_NAMES);
      const city = user.addressShort ?? pickOne(CITIES);
      const productSummary =
        order?.productSummary ??
        `${pickOne(PRODUCT_CATALOG).name} (${pickOne(["S", "M", "L"])})`;
      const orderAmount = order?.orderAmount ?? randInt(499, 3499);
      const orderId = order?.orderRef ?? `ORD-NDR-${standaloneSeq++}`;
      const ndrReason = pickOne(NDR_REASONS);
      const createdAt = daysAgo(randInt(0, 10));
      const resolvedAt =
        status === ShipmentStatus.REATTEMPT_CONFIRMED ||
        status === ShipmentStatus.RTO_CONFIRMED ||
        status === ShipmentStatus.RESCHEDULED ||
        status === ShipmentStatus.ADDRESS_UPDATED
          ? daysAgo(randInt(0, 3))
          : null;

      const shipment = await prisma.shipment.create({
        data: {
          awb: `AWB-NDR-${status.slice(0, 4)}-${i}-${Date.now().toString(36)}`,
          orderId,
          orderRowId: order?.id,
          customerName: `${first} ${last}`,
          phone: user.phone ?? randomPhone(30000 + i),
          secondaryPhone: user.secondaryPhone,
          productSummary,
          orderAmount,
          paymentType: order?.paymentType ?? pickOne([PaymentType.COD, PaymentType.PREPAID]),
          address: user.address ?? `${randInt(1, 99)}, ${city} Main Road, ${city}`,
          addressShort: city,
          secondaryAddress: user.secondaryAddress,
          ndrReason,
          languagePref: pickOne(["hi-en", "hi", "en"]),
          brandName: "ZeeStore",
          status,
          incentiveText: maybe("Free reattempt tomorrow between 10 AM – 2 PM", 0.75),
          deliveryDate: daysFromNow(randInt(-2, 3)),
          createdAt,
          resolvedAt,
        },
      });

      if (status === ShipmentStatus.CALL_IN_PROGRESS) {
        await prisma.call.create({
          data: {
            shipmentId: shipment.id,
            orderId: order?.id,
            segment: OpsSegment.NDR,
            triggerSource: CallTriggerSource.MANUAL,
            status: CallStatus.IN_PROGRESS,
            startedAt: new Date(),
            createdAt: new Date(),
          },
        });
      } else if (status !== ShipmentStatus.NDR_PENDING) {
        const outcome =
          status === ShipmentStatus.REATTEMPT_CONFIRMED
            ? CallOutcome.REATTEMPT_CONFIRMED
            : status === ShipmentStatus.RTO_CONFIRMED
              ? CallOutcome.RTO_CONFIRMED
              : status === ShipmentStatus.RESCHEDULED
                ? CallOutcome.RESCHEDULE
                : status === ShipmentStatus.ADDRESS_UPDATED
                  ? CallOutcome.ADDRESS_UPDATE
                  : status === ShipmentStatus.NEED_HUMAN
                    ? CallOutcome.NEED_HUMAN
                    : CallOutcome.NO_ANSWER;

        await prisma.call.create({
          data: {
            shipmentId: shipment.id,
            orderId: order?.id,
            segment: OpsSegment.NDR,
            triggerSource: pickOne([
              CallTriggerSource.MANUAL,
              CallTriggerSource.AUTOMATIC,
            ]),
            status: CallStatus.COMPLETED,
            outcome,
            reason: `NDR resolution: ${ndrReason}`,
            sentiment: pickOne(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
            durationSec: randInt(60, 360),
            costInr: randInt(5, 22),
            transcript: `Agent resolved ${ndrReason} with outcome ${outcome}.`,
            selectedSlotId:
              outcome === CallOutcome.REATTEMPT_CONFIRMED
                ? pickOne(["slot-morning", "slot-afternoon", "slot-evening"])
                : undefined,
            addressUpdate:
              outcome === CallOutcome.ADDRESS_UPDATE
                ? `${randInt(1, 50)}, Updated Lane, ${city}`
                : undefined,
            createdAt: daysAgo(randInt(0, 5)),
            endedAt: daysAgo(randInt(0, 4)),
          },
        });
      } else if (Math.random() < 0.4) {
        await prisma.call.create({
          data: {
            shipmentId: shipment.id,
            orderId: order?.id,
            segment: OpsSegment.NDR,
            triggerSource: CallTriggerSource.AUTOMATIC,
            status: CallStatus.COMPLETED,
            outcome: CallOutcome.NO_ANSWER,
            reason: "Customer did not pick up",
            durationSec: randInt(5, 20),
            costInr: randInt(2, 6),
            createdAt: daysAgo(randInt(0, 2)),
          },
        });
      }
    }
  }
}

async function seedExtraCallHistory(orders: SeededOrder[]) {
  const callableOrders = orders.filter(
    (o) =>
      o.status === OrderStatus.COD_PENDING ||
      o.status === OrderStatus.COD_CALLBACK,
  );
  for (const order of callableOrders.slice(0, 8)) {
    await prisma.call.create({
      data: {
        orderId: order.id,
        segment: OpsSegment.COD,
        triggerSource: CallTriggerSource.AUTOMATIC,
        status: pickOne(CALL_STATUSES),
        outcome: maybe(pickOne(COD_CALL_OUTCOMES), 0.6),
        durationSec: maybe(randInt(20, 240), 0.8),
        costInr: maybe(randInt(3, 16), 0.8),
        createdAt: daysAgo(randInt(0, 7)),
      },
    });
  }
}

async function main() {
  const codPerStatus = parseIntFlag("cod-per-status", 5);
  const ndrPerStatus = parseIntFlag("ndr-per-status", 4);
  const userCount = parseIntFlag("users", 30);
  const eventsPerUser = parseIntFlag("events-per-user", 5);

  console.log("Seeding VoiceOps test data...");
  console.log({ codPerStatus, ndrPerStatus, userCount, eventsPerUser });

  await prisma.event.deleteMany();
  await prisma.call.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.dialerSettings.deleteMany();

  await ensureDialerSettings();
  const products = await seedProducts();
  const users = await seedUsers(userCount);
  await seedLeadEventsAndCalls(users, products, eventsPerUser);
  const orders = await seedCodOrders(users, products, codPerStatus);
  await seedNdrShipments(users, orders, ndrPerStatus);
  await seedExtraCallHistory(orders);

  const [ordersByStatus, shipmentsByStatus, callsBySegment] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
    prisma.shipment.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
    prisma.call.groupBy({ by: ["segment"], _count: true, orderBy: { segment: "asc" } }),
  ]);

  const totals = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.shipment.count(),
    prisma.call.count(),
    prisma.event.count(),
  ]);

  console.log("\nSeed complete:");
  console.log({
    users: totals[0],
    products: totals[1],
    orders: totals[2],
    shipments: totals[3],
    calls: totals[4],
    events: totals[5],
  });
  console.log("\nCOD orders by status:");
  for (const row of ordersByStatus) {
    console.log(`  ${row.status}: ${row._count}`);
  }
  console.log("\nNDR shipments by status:");
  for (const row of shipmentsByStatus) {
    console.log(`  ${row.status}: ${row._count}`);
  }
  console.log("\nCalls by segment:");
  for (const row of callsBySegment) {
    console.log(`  ${row.segment}: ${row._count}`);
  }
  console.log(
    "\nCallable for testing: COD orders with COD_PENDING / COD_CALLBACK / COD_UNREACHABLE; NDR shipments with NDR_PENDING / NO_ANSWER / RESCHEDULED.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
