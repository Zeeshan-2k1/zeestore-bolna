import { makeBolnaCall } from "./bolna";
import { classifyCallError } from "./call-errors";
import {
  CallStatus,
  CallTriggerSource,
  OpsSegment,
  ShipmentStatus,
  type CallTriggerSourceValue,
  type OpsSegmentValue,
} from "./constants";
import { db } from "./db";
import { buildBolnaUserData } from "./ndr";

const CALLABLE_STATUSES = new Set<string>([
  ShipmentStatus.COD_PENDING,
  ShipmentStatus.COD_CALLBACK,
  ShipmentStatus.NDR_PENDING,
  ShipmentStatus.NO_ANSWER,
  ShipmentStatus.RESCHEDULED,
]);

export type TriggerCallOptions = {
  triggerSource: CallTriggerSourceValue;
  segment?: OpsSegmentValue;
};

export type TriggerCallSuccess = {
  ok: true;
  call: Awaited<ReturnType<typeof db.call.create>>;
  executionId: string;
};

export type TriggerCallFailure = {
  ok: false;
  call: Awaited<ReturnType<typeof db.call.create>>;
  error: string;
  failureCode: string;
};

export type TriggerCallResult = TriggerCallSuccess | TriggerCallFailure;

export async function countActiveCalls(segment: OpsSegmentValue = OpsSegment.NDR): Promise<number> {
  return db.call.count({
    where: {
      segment,
      status: { in: [CallStatus.QUEUED, CallStatus.IN_PROGRESS] },
    },
  });
}

async function recordFailedCall(
  shipmentId: string,
  triggerSource: CallTriggerSourceValue,
  segment: OpsSegmentValue,
  failureCode: string,
  message: string,
) {
  return db.call.create({
    data: {
      shipmentId,
      segment,
      status: CallStatus.FAILED,
      triggerSource,
      failureCode,
      reason: message,
      startedAt: new Date(),
      endedAt: new Date(),
    },
  });
}

export async function triggerCallForShipment(
  shipmentId: string,
  options: TriggerCallOptions = { triggerSource: CallTriggerSource.MANUAL },
): Promise<TriggerCallResult> {
  const segment = options.segment ?? OpsSegment.NDR;

  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (!CALLABLE_STATUSES.has(shipment.status)) {
    const { code, message } = classifyCallError(
      new Error(`Cannot call shipment in status ${shipment.status}`),
    );
    const call = await recordFailedCall(
      shipment.id,
      options.triggerSource,
      segment,
      code,
      message,
    );
    return { ok: false, call, error: message, failureCode: code };
  }

  if (shipment.status === ShipmentStatus.CALL_IN_PROGRESS) {
    const { code, message } = classifyCallError(
      new Error("Call already in progress"),
    );
    const call = await recordFailedCall(
      shipment.id,
      options.triggerSource,
      segment,
      code,
      message,
    );
    return { ok: false, call, error: message, failureCode: code };
  }

  const userData = buildBolnaUserData(shipment);

  try {
    const { executionId } = await makeBolnaCall({
      recipientPhone: shipment.phone,
      userData,
      segment,
    });

    const call = await db.call.create({
      data: {
        shipmentId: shipment.id,
        segment,
        bolnaExecutionId: executionId,
        status: CallStatus.QUEUED,
        triggerSource: options.triggerSource,
        startedAt: new Date(),
      },
    });

    await db.shipment.update({
      where: { id: shipment.id },
      data: { status: ShipmentStatus.CALL_IN_PROGRESS },
    });

    return { ok: true, call, executionId };
  } catch (err) {
    const { code, message } = classifyCallError(err);
    const call = await recordFailedCall(
      shipment.id,
      options.triggerSource,
      segment,
      code,
      message,
    );
    return { ok: false, call, error: message, failureCode: code };
  }
}
