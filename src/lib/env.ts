import { OpsSegment, type OpsSegmentValue } from "./constants";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  DATABASE_URL: required(
    "DATABASE_URL",
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/voiceops?schema=public",
  ),
  DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  PUBLIC_URL: required(
    "PUBLIC_URL",
    process.env.PUBLIC_URL ?? "http://localhost:3000",
  ),
  BOLNA_API_KEY: optional(process.env.BOLNA_API_KEY),
  /** Fallback when a segment-specific agent ID is not set */
  BOLNA_AGENT_ID: optional(process.env.BOLNA_AGENT_ID),
  BOLNA_AGENT_ID_LEADS: optional(process.env.BOLNA_AGENT_ID_LEADS),
  BOLNA_AGENT_ID_COD: optional(process.env.BOLNA_AGENT_ID_COD),
  BOLNA_AGENT_ID_NDR: optional(process.env.BOLNA_AGENT_ID_NDR),
  BOLNA_FROM_PHONE: optional(process.env.BOLNA_FROM_PHONE),
  BOLNA_VERIFIED_RECIPIENT_PHONE: optional(process.env.BOLNA_VERIFIED_RECIPIENT_PHONE),
} as const;

const SEGMENT_AGENT_ENV: Record<OpsSegmentValue, keyof typeof env> = {
  [OpsSegment.LEADS]: "BOLNA_AGENT_ID_LEADS",
  [OpsSegment.COD]: "BOLNA_AGENT_ID_COD",
  [OpsSegment.NDR]: "BOLNA_AGENT_ID_NDR",
};

export function resolveBolnaAgentId(segment: OpsSegmentValue): string {
  const segmentKey = SEGMENT_AGENT_ENV[segment];
  const segmentId = env[segmentKey];
  const fallback = env.BOLNA_AGENT_ID;
  const id = segmentId ?? fallback;
  if (!id) {
    throw new Error(
      `Missing Bolna agent for segment ${segment}. Set ${segmentKey} or BOLNA_AGENT_ID in your environment.`,
    );
  }
  return id;
}

export function assertBolnaConfigured(segment?: OpsSegmentValue) {
  if (!env.BOLNA_API_KEY) {
    throw new Error("Missing required environment variable: BOLNA_API_KEY");
  }
  if (segment) {
    resolveBolnaAgentId(segment);
    return;
  }
  if (
    !env.BOLNA_AGENT_ID &&
    !env.BOLNA_AGENT_ID_LEADS &&
    !env.BOLNA_AGENT_ID_COD &&
    !env.BOLNA_AGENT_ID_NDR
  ) {
    throw new Error(
      "Missing Bolna agent ID. Set BOLNA_AGENT_ID_LEADS, BOLNA_AGENT_ID_COD, BOLNA_AGENT_ID_NDR, or BOLNA_AGENT_ID.",
    );
  }
}
