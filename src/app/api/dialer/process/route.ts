import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { runDialerTick } from "@/lib/dialer-runner";

/** Manual / debug tick — production dialing uses `npm run dialer:worker` or `/api/cron/dialer`. */
export async function POST() {
  try {
    const tick = await runDialerTick();
    return NextResponse.json(tick);
  } catch (err) {
    return apiErrorResponse(err, "Failed to process dialer queue");
  }
}
