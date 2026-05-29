import { bolnaConfig } from "./bolna-config";
import type { OpsSegmentValue } from "./constants";
import { assertBolnaConfigured } from "./env";

type MakeCallParams = {
  recipientPhone: string;
  userData: Record<string, string>;
  segment: OpsSegmentValue;
};

type MakeCallResponse = {
  execution_id?: string;
  id?: string;
  status?: string;
  message?: string;
  error?: string;
};

export async function makeBolnaCall({
  recipientPhone,
  userData,
  segment,
}: MakeCallParams): Promise<{ executionId: string; raw: MakeCallResponse }> {
  assertBolnaConfigured(segment);

  const body: Record<string, unknown> = {
    agent_id: bolnaConfig.agentIdForSegment(segment),
    recipient_phone_number:
      bolnaConfig.verifiedRecipientPhone ?? recipientPhone,
    user_data: userData,
  };

  if (bolnaConfig.fromPhone) {
    body.from_phone_number = bolnaConfig.fromPhone;
  }

  console.log(body);

  let res: Response;
  try {
    res = await fetch(`${bolnaConfig.baseUrl}/call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bolnaConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("fetch failed: could not reach Bolna API");
  }

  const raw = (await res.json()) as MakeCallResponse;

  if (!res.ok) {
    throw new Error(
      raw.message ?? raw.error ?? `Bolna API error (${res.status})`,
    );
  }

  const executionId = raw.execution_id ?? raw.id;
  if (!executionId) {
    throw new Error("Bolna did not return an execution ID");
  }

  return { executionId, raw };
}

export type BolnaWebhookPayload = Record<string, unknown>;

export function extractExecutionId(
  payload: BolnaWebhookPayload,
): string | null {
  const candidates = [
    payload.id,
    payload.execution_id,
    (payload.data as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

export function extractStatus(payload: BolnaWebhookPayload): string {
  const status =
    payload.status ??
    (payload.data as Record<string, unknown> | undefined)?.status;
  return typeof status === "string" ? status.toLowerCase() : "unknown";
}

export function extractTranscript(payload: BolnaWebhookPayload): string | null {
  const candidates = [
    payload.transcript,
    payload.conversation,
    (payload.data as Record<string, unknown> | undefined)?.transcript,
  ];
  for (const c of candidates) {
    if (typeof c === "string") return c;
    if (c && typeof c === "object") return JSON.stringify(c, null, 2);
  }
  return null;
}

export function extractRecordingUrl(
  payload: BolnaWebhookPayload,
): string | null {
  const telephony = payload.telephony_data as
    | Record<string, unknown>
    | undefined;
  const candidates = [
    payload.recording_url,
    telephony?.recording_url,
    (payload.data as Record<string, unknown> | undefined)?.recording_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

export function extractDurationSec(
  payload: BolnaWebhookPayload,
): number | null {
  const telephony = payload.telephony_data as
    | Record<string, unknown>
    | undefined;
  const candidates = [
    payload.conversation_duration,
    payload.duration,
    telephony?.duration,
  ];
  for (const c of candidates) {
    if (typeof c === "number") return Math.round(c);
    if (typeof c === "string") {
      const n = parseFloat(c);
      if (!Number.isNaN(n)) return Math.round(n);
    }
  }
  return null;
}

export function extractExtractedData(
  payload: BolnaWebhookPayload,
): Record<string, unknown> | null {
  const candidates = [
    payload.extracted_data,
    payload.extraction,
    payload.structured_data,
    (payload.data as Record<string, unknown> | undefined)?.extracted_data,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      return c as Record<string, unknown>;
    }
  }

  // Some agents return JSON in transcript or a custom field
  const custom = payload.custom_data;
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    return custom as Record<string, unknown>;
  }

  return null;
}

export function extractCostInr(payload: BolnaWebhookPayload): number | null {
  const candidates = [payload.total_cost, payload.cost, payload.price];
  for (const c of candidates) {
    if (typeof c === "number") return c;
  }
  return null;
}
