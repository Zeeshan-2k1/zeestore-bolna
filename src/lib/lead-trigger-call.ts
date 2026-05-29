import { makeBolnaCall } from "./bolna";
import { classifyCallError } from "./call-errors";
import {
  CallStatus,
  CallTriggerSource,
  OpsSegment,
  ShopifyEventName,
  CallFailureCode,
  type CallTriggerSourceValue,
} from "./constants";
import { db } from "./db";
import { pickRandomPromotionalOffer } from "./promotional-offers";

export type TriggerLeadCallOptions = {
  triggerSource: CallTriggerSourceValue;
  leadScore?: number;
};

export type TriggerLeadCallResult =
  | {
      ok: true;
      leadCall: Awaited<ReturnType<typeof db.call.create>>;
      executionId: string;
    }
  | {
      ok: false;
      leadCall: Awaited<ReturnType<typeof db.call.create>>;
      error: string;
      failureCode: string;
    };

type LeadUserDataContext = {
  leadSegment: "abandoned_cart" | "product_page_visitor" | "checkout_drop" | "past_customer";
  productName: string;
  productSku: string;
  cartValue: number | null;
  activeOffer: string;
};

function asUserData(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}, options: TriggerLeadCallOptions, context: LeadUserDataContext) {
  return {
    // Prompt uses this segment variable for dynamic opening context.
    segment: context.leadSegment,
    workflow_segment: OpsSegment.LEADS,
    lead_id: user.id,
    first_name: user.firstName ?? "",
    last_name: user.lastName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    lead_score: String(options.leadScore ?? ""),
    product_name: context.productName,
    product_sku: context.productSku,
    cart_value: context.cartValue != null ? String(context.cartValue) : "",
    active_offer: context.activeOffer,
  };
}

async function deriveLeadUserDataContext(userId: string): Promise<LeadUserDataContext> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const events = await db.event.findMany({
    where: { userId, occurredAt: { gte: since } },
    include: { product: true },
    orderBy: { occurredAt: "desc" },
    take: 40,
  });

  const names = events.map((e) => e.eventName.toLowerCase());
  const hasCheckoutStart = names.includes(ShopifyEventName.CHECKOUT_STARTED);
  const hasCheckoutComplete = names.includes(ShopifyEventName.CHECKOUT_COMPLETED);
  const hasAddToCart = names.includes(ShopifyEventName.ADD_TO_CART);
  const hasProductView = names.includes(ShopifyEventName.PRODUCT_VIEWED);

  const leadSegment =
    hasCheckoutStart && !hasCheckoutComplete
      ? "checkout_drop"
      : hasAddToCart
        ? "abandoned_cart"
        : hasProductView
          ? "product_page_visitor"
          : "past_customer";

  const product = events.find((e) => e.product)?.product;
  return {
    leadSegment,
    productName: product?.name ?? "Fashion item",
    productSku: product?.sku ?? "",
    cartValue: product?.price ?? null,
    activeOffer: pickRandomPromotionalOffer(),
  };
}

async function recordLeadFailure(
  userId: string,
  options: TriggerLeadCallOptions,
  code: string,
  message: string,
) {
  return db.call.create({
    data: {
      userId,
      segment: OpsSegment.LEADS,
      status: CallStatus.FAILED,
      triggerSource: options.triggerSource,
      failureCode: code,
      reason: message,
      startedAt: new Date(),
      endedAt: new Date(),
    },
  });
}

export async function triggerLeadCall(
  userId: string,
  options: TriggerLeadCallOptions = { triggerSource: CallTriggerSource.MANUAL },
): Promise<TriggerLeadCallResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Lead user not found");
  }
  if (!user.phone) {
    const msg = "Lead user has no phone number";
    const leadCall = await recordLeadFailure(
      user.id,
      options,
      CallFailureCode.INVALID_STATUS,
      msg,
    );
    return {
      ok: false,
      leadCall,
      error: msg,
      failureCode: CallFailureCode.INVALID_STATUS,
    };
  }

  try {
    const userDataContext = await deriveLeadUserDataContext(user.id);

    const { executionId } = await makeBolnaCall({
      recipientPhone: user.phone,
      userData: asUserData(user, options, userDataContext),
      segment: OpsSegment.LEADS,
    });

    const leadCall = await db.call.create({
      data: {
        userId: user.id,
        segment: OpsSegment.LEADS,
        bolnaExecutionId: executionId,
        status: CallStatus.QUEUED,
        triggerSource: options.triggerSource,
        startedAt: new Date(),
      },
    });

    return { ok: true, leadCall, executionId };
  } catch (err) {
    const { code, message } = classifyCallError(err);
    const leadCall = await recordLeadFailure(user.id, options, code, message);
    return { ok: false, leadCall, error: message, failureCode: code };
  }
}

export async function countActiveLeadCalls(): Promise<number> {
  return db.call.count({
    where: {
      segment: OpsSegment.LEADS,
      status: { in: [CallStatus.QUEUED, CallStatus.IN_PROGRESS] },
    },
  });
}

