import {
  CallStatus,
  CallTriggerSource,
  CodCallableOrderStatuses,
  OpsSegment,
} from "./constants";
import {
  getOrCreateDialerSettings,
  processSegmentDialerQueue,
  toDialerDto,
  type DialerProcessResult,
  type DialerSettingsDto,
} from "./dialer";
import { db } from "./db";
import { parseDialerFilters } from "./dialer-filters";
import { triggerCallForCodOrder } from "./cod-trigger-call";

export async function getOrCreateCodDialerSettings() {
  return getOrCreateDialerSettings(OpsSegment.COD);
}

export const toCodDialerDto = toDialerDto;
export type CodDialerSettingsDto = DialerSettingsDto;
export type CodDialerProcessResult = DialerProcessResult;

export async function processCodDialerQueue(): Promise<CodDialerProcessResult> {
  const settings = await getOrCreateCodDialerSettings();
  const filters = parseDialerFilters(settings.filters).cod;
  return processSegmentDialerQueue(OpsSegment.COD, {
    countActive: async () =>
      db.call.count({
        where: {
          segment: OpsSegment.COD,
          status: { in: [CallStatus.QUEUED, CallStatus.IN_PROGRESS] },
        },
      }),
    pickTargets: (slots) =>
      db.order.findMany({
        where: {
          paymentType: "COD",
          status: { in: [...CodCallableOrderStatuses] },
          ...(filters?.productPrice
            ? {
                orderAmount:
                  filters.productPrice.op === "gt"
                    ? { gt: filters.productPrice.value }
                    : filters.productPrice.op === "lt"
                      ? { lt: filters.productPrice.value }
                      : { equals: filters.productPrice.value },
              }
            : {}),
          ...(filters?.status
            ? {
                status:
                  filters.status.op === "eq"
                    ? filters.status.value
                    : { not: filters.status.value },
              }
            : {}),
          ...(filters?.orderDate
            ? {
                orderDate:
                  filters.orderDate.op === "gt"
                    ? { gt: new Date(filters.orderDate.value) }
                    : { lt: new Date(filters.orderDate.value) },
              }
            : {}),
          ...(filters?.deliveryDate
            ? {
                expectedDeliveryDate:
                  filters.deliveryDate.op === "gt"
                    ? { gt: new Date(filters.deliveryDate.value) }
                    : { lt: new Date(filters.deliveryDate.value) },
              }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        take: slots,
        select: { id: true },
      }),
    trigger: async ({ id }) => {
      const outcome = await triggerCallForCodOrder(id, {
        triggerSource: CallTriggerSource.AUTOMATIC,
      });
      return outcome.ok ? { ok: true } : { ok: false, error: outcome.error };
    },
  });
}

