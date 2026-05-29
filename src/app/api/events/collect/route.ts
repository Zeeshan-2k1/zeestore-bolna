import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import {
  assertEventsApiKey,
  ingestEvents,
  type IncomingEvent,
} from "@/lib/event-ingest";

export async function POST(request: Request) {
  try {
    assertEventsApiKey(request);

    const body = (await request.json()) as
      | IncomingEvent
      | { events: IncomingEvent[] };

    const events = Array.isArray((body as { events?: unknown }).events)
      ? ((body as { events: IncomingEvent[] }).events ?? [])
      : [body as IncomingEvent];

    if (events.length === 0) {
      return NextResponse.json({ error: "No events provided" }, { status: 400 });
    }

    const result = await ingestEvents(events, request);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return apiErrorResponse(err, "Failed to ingest events");
  }
}
