import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { getCallAnalytics } from "@/lib/analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(
      90,
      Math.max(1, parseInt(searchParams.get("days") ?? "14", 10) || 14),
    );
    const segment = searchParams.get("segment") ?? "ALL";
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const analytics = await getCallAnalytics(days, { segment, startDate, endDate });
    return NextResponse.json(analytics);
  } catch (err) {
    return apiErrorResponse(err, "Failed to load analytics");
  }
}
