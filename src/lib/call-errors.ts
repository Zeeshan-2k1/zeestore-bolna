import { CallFailureCode, type CallFailureCodeValue } from "./constants";

export type ClassifiedCallError = {
  code: CallFailureCodeValue;
  message: string;
};

export function classifyCallError(err: unknown): ClassifiedCallError {
  const message =
    err instanceof Error ? err.message : "Failed to trigger call";

  if (message.includes("BOLNA_API_KEY") || message.includes("Missing required environment variable: BOLNA_API_KEY")) {
    return {
      code: CallFailureCode.MISSING_API_KEY,
      message: "Bolna API key is not set. Add BOLNA_API_KEY to your environment.",
    };
  }

  if (
    message.includes("BOLNA_AGENT_ID") ||
    message.includes("Missing Bolna agent") ||
    message.includes("Missing required environment variable: BOLNA_AGENT_ID")
  ) {
    return {
      code: CallFailureCode.MISSING_AGENT_ID,
      message:
        "Bolna agent ID is not set. Add BOLNA_AGENT_ID_LEADS, BOLNA_AGENT_ID_COD, BOLNA_AGENT_ID_NDR, or BOLNA_AGENT_ID.",
    };
  }

  if (message.includes("Bolna credentials") || message.includes("not configured")) {
    return {
      code: CallFailureCode.BOLNA_NOT_CONFIGURED,
      message,
    };
  }

  if (message.includes("Cannot call shipment")) {
    return { code: CallFailureCode.INVALID_STATUS, message };
  }

  if (message.includes("Call already in progress")) {
    return { code: CallFailureCode.CALL_IN_PROGRESS, message };
  }

  if (message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    return {
      code: CallFailureCode.NETWORK_ERROR,
      message: "Could not reach Bolna API. Check network and PUBLIC_URL.",
    };
  }

  const statusMatch = message.match(/Bolna API error \((\d+)\)/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 401 || status === 403) {
      return { code: CallFailureCode.UNAUTHORIZED, message };
    }
    if (status === 404) {
      return {
        code: CallFailureCode.ENDPOINT_NOT_FOUND,
        message: "Bolna call endpoint not found. Verify BOLNA_API_KEY and agent configuration.",
      };
    }
    if (status === 429) {
      return { code: CallFailureCode.RATE_LIMITED, message };
    }
    return { code: CallFailureCode.API_ERROR, message };
  }

  if (message.includes("did not return an execution")) {
    return { code: CallFailureCode.INVALID_RESPONSE, message };
  }

  if (message.toLowerCase().includes("bolna")) {
    return { code: CallFailureCode.API_ERROR, message };
  }

  return { code: CallFailureCode.UNKNOWN, message };
}
