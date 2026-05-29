import { CodCallOutcome, OrderStatus, ShipmentStatus } from "./constants";

export function parseCodCallOutcome(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const valid = Object.values(CodCallOutcome) as string[];
  return valid.includes(value) ? value : null;
}

export function mapCodOutcomeToOrderStatus(
  outcome: string | null,
  reason: string,
  callStatus: string,
): string {
  if (outcome === CodCallOutcome.COD_CONFIRMED) {
    return OrderStatus.COD_CONFIRMED;
  }
  if (outcome === CodCallOutcome.COD_REJECTED) {
    return OrderStatus.COD_CANCELLED;
  }
  if (outcome === CodCallOutcome.WRONG_ADDRESS) {
    return OrderStatus.COD_INVALID_ADDRESS;
  }
  if (outcome === CodCallOutcome.NO_ANSWER) {
    return OrderStatus.COD_UNREACHABLE;
  }
  if (outcome === CodCallOutcome.CALLBACK) {
    return OrderStatus.COD_CALLBACK;
  }

  // Fallback when outcome missing but call completed
  if (callStatus === "completed") {
    const r = reason.toLowerCase();
    if (r.includes("confirm") || r.includes("accept")) {
      return OrderStatus.COD_CONFIRMED;
    }
  }

  return mapCodFailureToStatus(reason, callStatus);
}

export function mapCodFailureToStatus(reason: string, status: string): string {
  const r = reason.toLowerCase();
  if (status === "no-answer" || status === "busy" || r.includes("pick")) {
    return OrderStatus.COD_UNREACHABLE;
  }
  if (r.includes("address")) return OrderStatus.COD_INVALID_ADDRESS;
  if (r.includes("cancel") || r.includes("not accept")) {
    return OrderStatus.COD_CANCELLED;
  }
  return OrderStatus.COD_CALLBACK;
}

export function mapCodReasonToNdrReason(reason: string, status: string): string {
  const r = reason.toLowerCase();
  if (r.includes("address")) return "WRONG_ADDRESS";
  if (r.includes("cod") || r.includes("cancel")) return "COD_REFUSED";
  if (status === "no-answer" || r.includes("pick")) return "CUSTOMER_UNAVAILABLE";
  return "OTHER";
}

export function codFailureRequiresNdr(orderStatus: string): boolean {
  return orderStatus !== OrderStatus.COD_CONFIRMED;
}
