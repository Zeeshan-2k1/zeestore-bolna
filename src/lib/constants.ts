/** Voice-ops pipeline segment (lead → COD → NDR). */
export const OpsSegment = {
  LEADS: "LEADS",
  COD: "COD",
  NDR: "NDR",
} as const;

export type OpsSegmentValue = (typeof OpsSegment)[keyof typeof OpsSegment];

export const PaymentType = {
  COD: "COD",
  PREPAID: "PREPAID",
} as const;

export const NdrReason = {
  CUSTOMER_UNAVAILABLE: "CUSTOMER_UNAVAILABLE",
  WRONG_ADDRESS: "WRONG_ADDRESS",
  COD_REFUSED: "COD_REFUSED",
  GATE_CLOSED: "GATE_CLOSED",
  PREPAID_SIMULATED_FAILURE: "PREPAID_SIMULATED_FAILURE",
  OTHER: "OTHER",
} as const;

export const CodFailureReason = {
  CALL_NOT_PICKED: "CALL_NOT_PICKED",
  WRONG_ADDRESS: "WRONG_ADDRESS",
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
  COD_NOT_ACCEPTED: "COD_NOT_ACCEPTED",
  OTHER: "OTHER",
} as const;

export const ShipmentStatus = {
  COD_PENDING: "COD_PENDING",
  COD_CONFIRMED: "COD_CONFIRMED",
  COD_CALLBACK: "COD_CALLBACK",
  COD_CANCELLED: "COD_CANCELLED",
  COD_INVALID_ADDRESS: "COD_INVALID_ADDRESS",
  COD_UNREACHABLE: "COD_UNREACHABLE",
  NDR_PENDING: "NDR_PENDING",
  CALL_IN_PROGRESS: "CALL_IN_PROGRESS",
  REATTEMPT_CONFIRMED: "REATTEMPT_CONFIRMED",
  RTO_CONFIRMED: "RTO_CONFIRMED",
  RESCHEDULED: "RESCHEDULED",
  ADDRESS_UPDATED: "ADDRESS_UPDATED",
  NEED_HUMAN: "NEED_HUMAN",
  NO_ANSWER: "NO_ANSWER",
} as const;

export const NdrShipmentStatuses = [
  ShipmentStatus.NDR_PENDING,
  ShipmentStatus.CALL_IN_PROGRESS,
  ShipmentStatus.REATTEMPT_CONFIRMED,
  ShipmentStatus.RTO_CONFIRMED,
  ShipmentStatus.RESCHEDULED,
  ShipmentStatus.ADDRESS_UPDATED,
  ShipmentStatus.NEED_HUMAN,
  ShipmentStatus.NO_ANSWER,
] as const;

export const CodShipmentStatuses = [
  ShipmentStatus.COD_PENDING,
  ShipmentStatus.COD_CONFIRMED,
  ShipmentStatus.COD_CALLBACK,
  ShipmentStatus.COD_CANCELLED,
  ShipmentStatus.COD_INVALID_ADDRESS,
  ShipmentStatus.COD_UNREACHABLE,
  ShipmentStatus.CALL_IN_PROGRESS,
  ShipmentStatus.NO_ANSWER,
] as const;

export const CallOutcome = {
  REATTEMPT_CONFIRMED: "REATTEMPT_CONFIRMED",
  RTO_CONFIRMED: "RTO_CONFIRMED",
  RESCHEDULE: "RESCHEDULE",
  ADDRESS_UPDATE: "ADDRESS_UPDATE",
  SECONDARY_CONTACT: "SECONDARY_CONTACT",
  NEED_HUMAN: "NEED_HUMAN",
  NO_ANSWER: "NO_ANSWER",
} as const;

/** LEADS segment outcomes from Bolna extraction */
export const LeadCallOutcome = {
  CONVERSION: "CONVERSION",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALLBACK: "CALLBACK",
  NO_ANSWER: "NO_ANSWER",
} as const;

/** COD segment outcomes from Bolna extraction */
export const CodCallOutcome = {
  COD_CONFIRMED: "COD_CONFIRMED",
  COD_REJECTED: "COD_REJECTED",
  WRONG_ADDRESS: "WRONG_ADDRESS",
  CALLBACK: "CALLBACK",
  NO_ANSWER: "NO_ANSWER",
} as const;

/** Event names that mean the user already paid / completed checkout — exclude from leads */
export const LeadExclusionEventNames = new Set([
  "purchase_completed",
  "payment_completed",
  "payment_done",
  "checkout_completed",
  "checkout_done",
]);

export function isLeadExclusionEvent(eventName: string): boolean {
  return LeadExclusionEventNames.has(eventName.toLowerCase().trim());
}

/** Open order statuses — user should not receive another LEADS call */
export const OpenOrderStatusesForLeadExclusion = [
  ShipmentStatus.COD_PENDING,
  ShipmentStatus.CALL_IN_PROGRESS,
  ShipmentStatus.COD_CALLBACK,
] as const;

export const OrderStatus = {
  COD_PENDING: "COD_PENDING",
  COD_CONFIRMED: "COD_CONFIRMED",
  COD_CALLBACK: "COD_CALLBACK",
  COD_CANCELLED: "COD_CANCELLED",
  COD_INVALID_ADDRESS: "COD_INVALID_ADDRESS",
  COD_UNREACHABLE: "COD_UNREACHABLE",
  PREPAID_FULFILLED: "PREPAID_FULFILLED",
  CANCELLED: "CANCELLED",
} as const;

/** Order statuses eligible for outbound COD confirmation / retry calls */
export const CodCallableOrderStatuses = [
  OrderStatus.COD_PENDING,
  OrderStatus.COD_CALLBACK,
  OrderStatus.COD_UNREACHABLE,
  ShipmentStatus.NO_ANSWER,
] as const;

export const CallStatus = {
  QUEUED: "QUEUED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export const CallTriggerSource = {
  MANUAL: "MANUAL",
  AUTOMATIC: "AUTOMATIC",
} as const;

export const LeadIntent = {
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
} as const;

export const ShopifyEventName = {
  PAGE_VIEWED: "page_viewed",
  PRODUCT_VIEWED: "product_viewed",
  SEARCH_SUBMITTED: "search_submitted",
  ADD_TO_CART: "add_to_cart",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  PURCHASED: "purchase_completed",
} as const;

/** Recorded when the Bolna API or pre-call validation fails before a live call starts. */
export const CallFailureCode = {
  MISSING_API_KEY: "MISSING_API_KEY",
  MISSING_AGENT_ID: "MISSING_AGENT_ID",
  BOLNA_NOT_CONFIGURED: "BOLNA_NOT_CONFIGURED",
  NETWORK_ERROR: "NETWORK_ERROR",
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  API_ERROR: "API_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_STATUS: "INVALID_STATUS",
  CALL_IN_PROGRESS: "CALL_IN_PROGRESS",
  UNKNOWN: "UNKNOWN",
} as const;

export const NDR_REASON_LABELS: Record<string, string> = {
  CUSTOMER_UNAVAILABLE: "Customer not available at delivery address",
  WRONG_ADDRESS: "Incorrect or incomplete address",
  COD_REFUSED: "Customer refused COD payment",
  GATE_CLOSED: "Society or gate closed — delivery blocked",
  PREPAID_SIMULATED_FAILURE: "Simulated prepaid delivery failure",
  OTHER: "Delivery could not be completed",
};

export type PaymentTypeValue = (typeof PaymentType)[keyof typeof PaymentType];
export type NdrReasonValue = (typeof NdrReason)[keyof typeof NdrReason];
export type CodFailureReasonValue =
  (typeof CodFailureReason)[keyof typeof CodFailureReason];
export type ShipmentStatusValue =
  (typeof ShipmentStatus)[keyof typeof ShipmentStatus];
export type CallOutcomeValue = (typeof CallOutcome)[keyof typeof CallOutcome];
export type LeadCallOutcomeValue =
  (typeof LeadCallOutcome)[keyof typeof LeadCallOutcome];
export type CodCallOutcomeValue =
  (typeof CodCallOutcome)[keyof typeof CodCallOutcome];
export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];
export type CallStatusValue = (typeof CallStatus)[keyof typeof CallStatus];
export type CallTriggerSourceValue =
  (typeof CallTriggerSource)[keyof typeof CallTriggerSource];
export type LeadIntentValue = (typeof LeadIntent)[keyof typeof LeadIntent];
export type ShopifyEventNameValue =
  (typeof ShopifyEventName)[keyof typeof ShopifyEventName];
export type CallFailureCodeValue =
  (typeof CallFailureCode)[keyof typeof CallFailureCode];

export const CALL_FAILURE_LABELS: Record<string, string> = {
  MISSING_API_KEY: "Bolna API key not configured",
  MISSING_AGENT_ID: "Bolna agent ID not configured",
  BOLNA_NOT_CONFIGURED: "Bolna credentials not configured",
  NETWORK_ERROR: "Could not reach Bolna API",
  ENDPOINT_NOT_FOUND: "Bolna API endpoint not found",
  UNAUTHORIZED: "Bolna API rejected credentials",
  RATE_LIMITED: "Bolna API rate limit exceeded",
  API_ERROR: "Bolna API returned an error",
  INVALID_RESPONSE: "Bolna API response missing execution ID",
  INVALID_STATUS: "Shipment not eligible for calling",
  CALL_IN_PROGRESS: "Call already in progress",
  UNKNOWN: "Unknown error while triggering call",
};
