import { PrismaClient } from "@prisma/client";
import {
  CallOutcome,
  CallStatus,
  CallTriggerSource,
  LeadCallOutcome,
  NdrReason,
  OpsSegment,
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
const SHIPMENT_REASONS = Object.values(NdrReason);
const SHIPMENT_STATUSES = Object.values(ShipmentStatus);
const CALL_OUTCOMES = Object.values(CallOutcome);
const CALL_STATUSES = Object.values(CallStatus);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function maybe<T>(value: T, probability = 0.5): T | undefined {
  return Math.random() < probability ? value : undefined;
}

function randomPhone(seed: number) {
  return `+9198${String(10000000 + seed).slice(-8)}`;
}

function parseIntFlag(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const v = Number(raw.split("=")[1]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

async function ensureDialerSettings() {
  await prisma.dialerSettings.upsert({
    where: { id: OpsSegment.NDR },
    update: {},
    create: { id: OpsSegment.NDR, segment: OpsSegment.NDR, enabled: false },
  });
  await prisma.dialerSettings.upsert({
    where: { id: OpsSegment.LEADS },
    update: {},
    create: { id: OpsSegment.LEADS, segment: OpsSegment.LEADS, enabled: false },
  });
  await prisma.dialerSettings.upsert({
    where: { id: OpsSegment.COD },
    update: {},
    create: { id: OpsSegment.COD, segment: OpsSegment.COD, enabled: false },
  });
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

async function seedShipments(count: number) {
  for (let i = 0; i < count; i += 1) {
    const first = pickOne(FIRST_NAMES);
    const last = pickOne(LAST_NAMES);
    const city = pickOne(CITIES);
    const product = pickOne(PRODUCT_CATALOG);
    await prisma.shipment.create({
      data: {
        awb: `AWB${Date.now()}${i}`,
        orderId: `ORD-${10000 + i}`,
        customerName: `${first} ${last}`,
        phone: randomPhone(i),
        productSummary: `${product.name} (${pickOne(["S", "M", "L", "XL"])})`,
        orderAmount: product.price,
        paymentType: pickOne([PaymentType.COD, PaymentType.PREPAID]),
        address: `${randInt(1, 99)}, ${city} Main Road, ${city}`,
        addressShort: city,
        ndrReason: pickOne(SHIPMENT_REASONS),
        languagePref: pickOne(["hi-en", "hi", "en"]),
        brandName: "QuickCart",
        status: pickOne(SHIPMENT_STATUSES),
        incentiveText: maybe("Free reattempt tomorrow", 0.7),
      },
    });
  }
}

async function seedUsersAndEvents(
  userCount: number,
  eventsPerUser: number,
  products: { id: string; sku: string; name: string; price: number }[],
) {
  for (let i = 0; i < userCount; i += 1) {
    const first = pickOne(FIRST_NAMES);
    const last = pickOne(LAST_NAMES);
    const city = pickOne(CITIES);
    const user = await prisma.user.create({
      data: {
        shopifyCustomerId: `shop_${Date.now()}_${i}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
        phone: randomPhone(10000 + i),
        firstName: first,
        lastName: last,
        address: `${randInt(1, 99)}, ${city} Main Road, ${city}`,
        addressShort: city,
        source: "SHOPIFY",
      },
    });

    const product = pickOne(products);

    for (let j = 0; j < eventsPerUser; j += 1) {
      const eventName = pickOne(LEAD_EVENTS);
      const occurredAt = new Date(Date.now() - randInt(0, 20 * 24 * 3600 * 1000));
      await prisma.event.create({
        data: {
          userId: user.id,
          productId: product.id,
          platform: "SHOPIFY",
          source: pickOne([...EVENT_SOURCES]),
          eventName,
          externalEventId: `evt_${Date.now()}_${i}_${j}`,
          occurredAt,
          properties: JSON.stringify({
            page: pickOne(["home", "product", "checkout"]),
            cart_value: randInt(500, 10000),
            campaign: pickOne(["summer-sale", "retargeting", "organic"]),
            sku: product.sku,
            product_id: product.id,
          }),
        },
      });
    }

    if (Math.random() < 0.4) {
      await prisma.call.create({
        data: {
          userId: user.id,
          segment: OpsSegment.LEADS,
          triggerSource: pickOne([
            CallTriggerSource.MANUAL,
            CallTriggerSource.AUTOMATIC,
          ]),
          status: pickOne(CALL_STATUSES),
          outcome: maybe(pickOne([...Object.values(LeadCallOutcome)]), 0.5),
          reason: maybe("Lead qualification attempt"),
          sentiment: maybe(pickOne(["POSITIVE", "NEUTRAL", "NEGATIVE"]), 0.7),
          durationSec: maybe(randInt(20, 320), 0.8),
          costInr: maybe(randInt(2, 25), 0.8),
          createdAt: new Date(Date.now() - randInt(0, 7 * 24 * 3600 * 1000)),
        },
      });
    }
  }
}

async function main() {
  const shipmentCount = parseIntFlag("shipments", 25);
  const userCount = parseIntFlag("users", 40);
  const eventsPerUser = parseIntFlag("events-per-user", 6);

  console.log("Seeding random mock data...");
  console.log({ shipmentCount, userCount, eventsPerUser });

  await prisma.event.deleteMany();
  await prisma.call.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.dialerSettings.deleteMany();

  await ensureDialerSettings();
  const products = await seedProducts();
  await seedShipments(shipmentCount);
  await seedUsersAndEvents(userCount, eventsPerUser, products);

  const [shipments, users, productsCount, events, calls, dialers] = await Promise.all([
    prisma.shipment.count(),
    prisma.user.count(),
    prisma.product.count(),
    prisma.event.count(),
    prisma.call.count(),
    prisma.dialerSettings.count(),
  ]);

  console.log("Seed complete:");
  console.log({ shipments, users, products: productsCount, events, calls, dialers });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
