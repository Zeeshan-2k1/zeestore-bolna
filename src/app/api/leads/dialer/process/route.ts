import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { processLeadDialerQueue } from "@/lib/lead-dialer";

/** Manual / debug lead dialer tick. */
export async function POST() {
  try {
    const result = await processLeadDialerQueue();
    return NextResponse.json(result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to process lead dialer queue");
  }
}

