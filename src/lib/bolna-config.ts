import type { OpsSegmentValue } from "./constants";
import { env, resolveBolnaAgentId } from "./env";


function normalizePhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits;
}

export const bolnaConfig = {
  get apiKey() {
    return env.BOLNA_API_KEY;
  },
  /** @deprecated Use agentIdForSegment(segment) */
  get agentId() {
    return env.BOLNA_AGENT_ID ?? env.BOLNA_AGENT_ID_NDR ?? "";
  },
  agentIdForSegment(segment: OpsSegmentValue): string {
    return resolveBolnaAgentId(segment);
  },
  baseUrl: "https://api.bolna.ai",
  get fromPhone() {
    return env.BOLNA_FROM_PHONE;
  },
  get publicUrl() {
    return env.PUBLIC_URL;
  },
  get verifiedRecipientPhone() {
    return normalizePhone(env.BOLNA_VERIFIED_RECIPIENT_PHONE);
  },
} as const;
