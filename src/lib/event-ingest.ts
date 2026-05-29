import { db } from "./db";

type AnyObject = Record<string, unknown>;

export type IncomingEvent = {
  id?: string;
  event_id?: string;
  event?: string;
  event_name?: string;
  name?: string;
  type?: string;
  source?: string;
  event_source?: string;
  occurred_at?: string | number | Date;
  timestamp?: string | number | Date;
  created_at?: string | number | Date;
  customer_id?: string | number;
  user_id?: string | number;
  product_id?: string | number;
  sku?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  properties?: AnyObject;
  customer?: AnyObject;
  [key: string]: unknown;
};

export type IngestRejectReason =
  | "missing_user_ref"
  | "user_not_found"
  | "missing_product_ref"
  | "product_not_found"
  | "duplicate";

export type IngestEventResult = {
  accepted: number;
  rejected: number;
  ignored: number;
  rejections: Array<{ index: number; reason: IngestRejectReason; detail?: string }>;
};

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
}

function normalizeEmail(value: unknown): string | undefined {
  const v = clean(value);
  return v ? v.toLowerCase() : undefined;
}

function normalizePhone(value: unknown): string | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  const keep = raw.replace(/[^\d+]/g, "");
  return keep.length >= 8 ? keep : undefined;
}

function parseTime(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function asObject(value: unknown): AnyObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyObject;
  }
  return {};
}

function getEventName(event: IncomingEvent): string {
  return (
    clean(event.event_name) ??
    clean(event.event) ??
    clean(event.name) ??
    clean(event.type) ??
    "unknown_event"
  );
}

async function lookupUser(event: IncomingEvent): Promise<string | null> {
  const properties = asObject(event.properties);
  const customer = asObject(event.customer);

  const internalUserId = clean(event.user_id as string) ?? clean(properties.user_id as string);
  if (internalUserId) {
    const byId = await db.user.findUnique({ where: { id: internalUserId } });
    if (byId) return byId.id;
  }

  const shopifyCustomerId =
    String(
      event.customer_id ??
        customer.id ??
        properties.customer_id ??
        "",
    ).trim() || undefined;

  const email =
    normalizeEmail(event.email) ??
    normalizeEmail(customer.email) ??
    normalizeEmail(properties.email);

  const phone =
    normalizePhone(event.phone) ??
    normalizePhone(customer.phone) ??
    normalizePhone(properties.phone);

  if (shopifyCustomerId) {
    const u = await db.user.findUnique({ where: { shopifyCustomerId } });
    if (u) return u.id;
  }
  if (email) {
    const u = await db.user.findFirst({ where: { email } });
    if (u) return u.id;
  }
  if (phone) {
    const u = await db.user.findFirst({ where: { phone } });
    if (u) return u.id;
  }

  return null;
}

async function lookupProduct(event: IncomingEvent): Promise<string | null> {
  const properties = asObject(event.properties);

  const productId =
    clean(event.product_id as string) ?? clean(properties.product_id as string);
  if (productId) {
    const byId = await db.product.findUnique({ where: { id: productId } });
    if (byId) return byId.id;
  }

  const sku = clean(event.sku) ?? clean(properties.sku);
  if (sku) {
    const bySku = await db.product.findUnique({ where: { sku } });
    if (bySku) return bySku.id;
  }

  const shopifyProductId =
    clean(properties.shopify_product_id as string) ??
    clean(properties.shopifyProductId as string);
  if (shopifyProductId) {
    const byShopify = await db.product.findFirst({
      where: { shopifyProductId },
    });
    if (byShopify) return byShopify.id;
  }

  return null;
}

function checkEventsApiKey(request?: Request): boolean {
  const key = process.env.EVENTS_API_KEY?.trim();
  if (!key) return true;
  if (!request) return false;
  const header = request.headers.get("x-api-key") ?? request.headers.get("authorization");
  if (!header) return false;
  if (header === key) return true;
  if (header.startsWith("Bearer ") && header.slice(7) === key) return true;
  return false;
}

export function assertEventsApiKey(request: Request): void {
  if (!checkEventsApiKey(request)) {
    throw new Error("Unauthorized");
  }
}

export async function ingestEvents(
  input: IncomingEvent[],
  _request?: Request,
): Promise<IngestEventResult> {
  let accepted = 0;
  let rejected = 0;
  let ignored = 0;
  const rejections: IngestEventResult["rejections"] = [];

  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    try {
      const userId = await lookupUser(raw);
      if (!userId) {
        rejected += 1;
        rejections.push({
          index,
          reason: "user_not_found",
          detail: "User must exist before ingest",
        });
        continue;
      }

      const productId = await lookupProduct(raw);
      if (!productId) {
        rejected += 1;
        rejections.push({
          index,
          reason: "product_not_found",
          detail: "Product must exist before ingest",
        });
        continue;
      }

      const eventName = getEventName(raw);
      const externalEventId =
        clean(raw.event_id) ??
        clean(raw.id) ??
        clean(asObject(raw.properties).event_id);

      await db.event.create({
        data: {
          userId,
          productId,
          platform: "SHOPIFY",
          source:
            clean(raw.event_source)?.toUpperCase() === "SERVER"
              ? "SERVER"
              : "CLIENT",
          eventName,
          externalEventId,
          occurredAt: parseTime(
            raw.occurred_at ?? raw.timestamp ?? raw.created_at,
          ),
          properties: JSON.stringify({
            ...asObject(raw.properties),
            _ingest: {
              customer_id: raw.customer_id,
              user_id: raw.user_id,
              product_id: raw.product_id,
              sku: raw.sku,
            },
          }),
        },
      });
      accepted += 1;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("unique")
      ) {
        ignored += 1;
        rejections.push({ index, reason: "duplicate" });
      } else {
        rejected += 1;
        rejections.push({
          index,
          reason: "missing_user_ref",
          detail: err instanceof Error ? err.message : "unknown",
        });
        console.warn("Failed to ingest event:", err);
      }
    }
  }

  return { accepted, rejected, ignored, rejections };
}
