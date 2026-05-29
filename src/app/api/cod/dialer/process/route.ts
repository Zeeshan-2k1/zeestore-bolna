import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { processCodDialerQueue } from "@/lib/cod-dialer";

export async function POST() {
  try {
    const result = await processCodDialerQueue();
    return NextResponse.json({ result, mode: "manual-debug-tick" });
  } catch (err) {
    return apiErrorResponse(err, "Failed to process COD dialer queue");
  }
}

