import type { Shipment } from "@prisma/client";
import {
  CallOutcome,
  NDR_REASON_LABELS,
  OpsSegment,
  ShipmentStatus,
  type CallOutcomeValue,
  type ShipmentStatusValue,
} from "./constants";

export function getNdrReasonLabel(reason: string): string {
  return NDR_REASON_LABELS[reason] ?? NDR_REASON_LABELS.OTHER;
}

export function getReattemptSlots() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return [
    { id: "S1", label: `Tomorrow 10am–2pm (${fmt(tomorrow)})` },
    { id: "S2", label: `Tomorrow 2pm–6pm (${fmt(tomorrow)})` },
    { id: "S3", label: `Day after 10am–2pm (${fmt(dayAfter)})` },
  ];
}

export function buildBolnaUserData(shipment: Shipment) {
  const slots = getReattemptSlots();

  return {
    segment: OpsSegment.NDR,
    customer_name: shipment.customerName,
    order_id: shipment.orderId,
    product_summary: shipment.productSummary,
    order_amount: String(shipment.orderAmount),
    payment_type: shipment.paymentType,
    address_short: shipment.addressShort,
    ndr_reason_label: getNdrReasonLabel(shipment.ndrReason),
    language_pref: shipment.languagePref,
    reattempt_slots_json: JSON.stringify(slots),
    incentive_text: shipment.incentiveText ?? "none",
    shipment_id: shipment.id,
    awb: shipment.awb,
  };
}

export function mapOutcomeToShipmentStatus(
  outcome: CallOutcomeValue,
): ShipmentStatusValue {
  switch (outcome) {
    case CallOutcome.REATTEMPT_CONFIRMED:
      return ShipmentStatus.REATTEMPT_CONFIRMED;
    case CallOutcome.RTO_CONFIRMED:
      return ShipmentStatus.RTO_CONFIRMED;
    case CallOutcome.RESCHEDULE:
      return ShipmentStatus.RESCHEDULED;
    case CallOutcome.ADDRESS_UPDATE:
      return ShipmentStatus.ADDRESS_UPDATED;
    case CallOutcome.SECONDARY_CONTACT:
      return ShipmentStatus.ADDRESS_UPDATED;
    case CallOutcome.NEED_HUMAN:
      return ShipmentStatus.NEED_HUMAN;
    case CallOutcome.NO_ANSWER:
      return ShipmentStatus.NO_ANSWER;
    default:
      return ShipmentStatus.NDR_PENDING;
  }
}

export function parseCallOutcome(value: unknown): CallOutcomeValue | null {
  if (typeof value !== "string") return null;
  const valid = Object.values(CallOutcome) as string[];
  return valid.includes(value) ? (value as CallOutcomeValue) : null;
}
