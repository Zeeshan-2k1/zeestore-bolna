import { makeBolnaCall } from "./bolna";
import { classifyCallError } from "./call-errors";
import {
  CallStatus,
  CallTriggerSource,
  CodCallableOrderStatuses,
  OpsSegment,
  ShipmentStatus,
  type CallTriggerSourceValue,
} from "./constants";
import { db } from "./db";

const COD_CALLABLE_STATUSES = new Set<string>(CodCallableOrderStatuses);

export type TriggerCodCallResult =
  | {
      ok: true;
      call: Awaited<ReturnType<typeof db.call.create>>;
      executionId: string;
    }
  | {
      ok: false;
      call: Awaited<ReturnType<typeof db.call.create>>;
      error: string;
      failureCode: string;
    };

type TriggerCodCallOptions = {
  triggerSource: CallTriggerSourceValue;
};

function buildCodUserData(order: {
  id: string;
  orderRef: string;
  productSummary: string;
  orderAmount: number;
  expectedDeliveryDate: Date;
  addressShort: string;
  paymentType: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}) {
  return {
    segment: OpsSegment.COD,
    order_id: order.id,
    order_ref: order.orderRef,
    customer_name: [order.user.firstName, order.user.lastName]
      .filter(Boolean)
      .join(" "),
    recipient_phone: order.user.phone ?? "",
    product_summary: order.productSummary,
    order_amount: String(order.orderAmount),
    expected_delivery_date: order.expectedDeliveryDate.toISOString(),
    address_short: order.addressShort,
    payment_type: order.paymentType,
  };
}

async function recordCodFailure(
  orderId: string,
  userId: string,
  triggerSource: CallTriggerSourceValue,
  failureCode: string,
  message: string,
) {
  return db.call.create({
    data: {
      orderId,
      userId,
      segment: OpsSegment.COD,
      status: CallStatus.FAILED,
      triggerSource,
      failureCode,
      reason: message,
      startedAt: new Date(),
      endedAt: new Date(),
    },
  });
}

export async function triggerCallForCodOrder(
  orderId: string,
  options: TriggerCodCallOptions = { triggerSource: CallTriggerSource.MANUAL },
): Promise<TriggerCodCallResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: { firstName: true, lastName: true, phone: true },
      },
    },
  });
  if (!order) throw new Error("COD order not found");
  if (!order.user.phone) {
    const msg = "Order user has no phone number";
    const call = await recordCodFailure(
      order.id,
      order.userId,
      options.triggerSource,
      "INVALID_STATUS",
      msg,
    );
    return { ok: false, call, error: msg, failureCode: "INVALID_STATUS" };
  }
  if (!COD_CALLABLE_STATUSES.has(order.status)) {
    const { code, message } = classifyCallError(
      new Error(`Cannot call order in status ${order.status}`),
    );
    const call = await recordCodFailure(
      order.id,
      order.userId,
      options.triggerSource,
      code,
      message,
    );
    return { ok: false, call, error: message, failureCode: code };
  }

  try {
    const { executionId } = await makeBolnaCall({
      recipientPhone: order.user.phone,
      userData: buildCodUserData(order),
      segment: OpsSegment.COD,
    });

    const call = await db.call.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        segment: OpsSegment.COD,
        bolnaExecutionId: executionId,
        status: CallStatus.QUEUED,
        triggerSource: options.triggerSource,
        startedAt: new Date(),
      },
    });

    await db.order.update({
      where: { id: order.id },
      data: { status: ShipmentStatus.CALL_IN_PROGRESS },
    });

    return { ok: true, call, executionId };
  } catch (err) {
    const { code, message } = classifyCallError(err);
    const call = await recordCodFailure(
      order.id,
      order.userId,
      options.triggerSource,
      code,
      message,
    );
    return { ok: false, call, error: message, failureCode: code };
  }
}
