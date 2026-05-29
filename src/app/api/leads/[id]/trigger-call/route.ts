import { NextResponse } from "next/server";
import { CallTriggerSource } from "@/lib/constants";
import { triggerLeadCall } from "@/lib/lead-trigger-call";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const result = await triggerLeadCall(id, {
      triggerSource: CallTriggerSource.MANUAL,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          failureCode: result.failureCode,
          leadCall: result.leadCall,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      leadCall: result.leadCall,
      executionId: result.executionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to trigger lead call";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

