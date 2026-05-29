import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { listPotentialLeads, parseLeadListParams } from "@/lib/lead-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseLeadListParams(searchParams);
    const result = await listPotentialLeads(params);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load leads");
  }
}

