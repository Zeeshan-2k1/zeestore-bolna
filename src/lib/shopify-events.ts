import { ingestEvents, type IncomingEvent } from "./event-ingest";

/** @deprecated Use IncomingEvent from event-ingest */
export type ShopifyIncomingEvent = IncomingEvent;

export async function ingestShopifyEvents(input: IncomingEvent[]) {
  const result = await ingestEvents(input);
  return {
    accepted: result.accepted,
    ignored: result.ignored + result.rejected,
    mappedUsers: result.accepted,
    rejected: result.rejected,
    rejections: result.rejections,
  };
}

export { ingestEvents, type IncomingEvent } from "./event-ingest";
