import type { Call, Order, Shipment, User } from "@prisma/client";
import { CallOutcome, OrderStatus } from "./constants";
import { db } from "./db";
import { mapOutcomeToShipmentStatus } from "./ndr";

type NdrContext = {
  call: Call;
  shipment: Shipment;
  order: Order | null;
  user: User | null;
  outcome: string;
  extracted: Record<string, unknown> | null;
};

export async function applyNdrOutcomeWriteback(ctx: NdrContext): Promise<void> {
  const { call, shipment, order, user, outcome, extracted } = ctx;
  const shipmentStatus = mapOutcomeToShipmentStatus(
    outcome as (typeof CallOutcome)[keyof typeof CallOutcome],
  );

  const shipmentUpdate: {
    status: string;
    resolvedAt?: Date;
    address?: string;
    addressShort?: string;
    secondaryPhone?: string;
    secondaryAddress?: string;
    deliveryDate?: Date;
  } = {
    status: shipmentStatus,
    resolvedAt:
      shipmentStatus !== "NDR_PENDING" && shipmentStatus !== "CALL_IN_PROGRESS"
        ? new Date()
        : undefined,
  };

  if (outcome === CallOutcome.ADDRESS_UPDATE && call.addressUpdate) {
    const mode =
      typeof extracted?.address_mode === "string"
        ? extracted.address_mode.toLowerCase()
        : "secondary";
    if (mode === "primary" || mode === "replace") {
      shipmentUpdate.address = call.addressUpdate;
      shipmentUpdate.addressShort =
        (typeof extracted?.address_short === "string" && extracted.address_short) ||
        call.addressUpdate.slice(0, 40);
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: {
            address: call.addressUpdate,
            addressShort: shipmentUpdate.addressShort,
          },
        });
      }
      if (order) {
        await db.order.update({
          where: { id: order.id },
          data: {
            address: call.addressUpdate,
            addressShort: shipmentUpdate.addressShort,
          },
        });
      }
    } else {
      shipmentUpdate.secondaryAddress = call.addressUpdate;
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: { secondaryAddress: call.addressUpdate },
        });
      }
    }
  }

  if (outcome === CallOutcome.SECONDARY_CONTACT) {
    const phone =
      typeof extracted?.secondary_phone === "string"
        ? extracted.secondary_phone
        : typeof extracted?.alternate_phone === "string"
          ? extracted.alternate_phone
          : null;
    if (phone) {
      shipmentUpdate.secondaryPhone = phone;
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: { secondaryPhone: phone },
        });
      }
    }
  }

  if (outcome === CallOutcome.RESCHEDULE) {
    const slotDate =
      typeof extracted?.reschedule_date === "string"
        ? new Date(extracted.reschedule_date)
        : call.selectedSlotId
          ? parseSlotToDate(call.selectedSlotId)
          : null;
    if (slotDate && !Number.isNaN(slotDate.getTime())) {
      shipmentUpdate.deliveryDate = slotDate;
      if (order) {
        await db.order.update({
          where: { id: order.id },
          data: { expectedDeliveryDate: slotDate },
        });
      }
    }
  }

  if (outcome === CallOutcome.RTO_CONFIRMED && order) {
    await db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  await db.shipment.update({
    where: { id: shipment.id },
    data: shipmentUpdate,
  });
}

function parseSlotToDate(slotId: string): Date | null {
  const d = new Date();
  if (slotId === "S1" || slotId === "S2") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (slotId === "S3") {
    d.setDate(d.getDate() + 2);
    return d;
  }
  return null;
}
