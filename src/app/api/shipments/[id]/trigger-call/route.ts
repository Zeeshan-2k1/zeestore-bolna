import { NextResponse } from "next/server";
import { CallTriggerSource, OpsSegment } from "@/lib/constants";
import { triggerCallForShipment } from "@/lib/trigger-call";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const result = await triggerCallForShipment(id, {
      triggerSource: CallTriggerSource.MANUAL,
      segment: OpsSegment.NDR,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          failureCode: result.failureCode,
          call: result.call,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      call: result.call,
      executionId: result.executionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to trigger call";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
