import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import {
  CALL_LOG_FILTER_OPTIONS,
  getCallLog,
  parseCallLogQuery,
} from "@/lib/call-log-query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseCallLogQuery(searchParams);
    const result = await getCallLog(query);

    return NextResponse.json({
      ...result,
      filterOptions: CALL_LOG_FILTER_OPTIONS,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load call log");
  }
}
