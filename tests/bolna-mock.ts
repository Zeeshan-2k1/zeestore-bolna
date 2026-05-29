import { vi } from "vitest";

export type BolnaFetchRecord = {
  url: string;
  agentId: string;
  segment: string | undefined;
  workflowSegment: string | undefined;
  phone: string;
};

const calls: BolnaFetchRecord[] = [];

export function getBolnaFetchCalls(): BolnaFetchRecord[] {
  return [...calls];
}

export function resetBolnaFetchCalls() {
  calls.length = 0;
}

let executionCounter = 0;

export function setupBolnaFetchMock() {
  executionCounter = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.bolna.ai")) {
        throw new Error(`Unexpected fetch in tests: ${url}`);
      }

      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : {};
      const agentId = String(body.agent_id ?? "");
      const userData = (body.user_data ?? {}) as Record<string, string>;
      executionCounter += 1;
      const executionId = `test-exec-${agentId}-${executionCounter}`;

      calls.push({
        url,
        agentId,
        segment: userData.segment,
        workflowSegment: userData.workflow_segment,
        phone: String(body.recipient_phone_number ?? ""),
      });

      return new Response(
        JSON.stringify({ execution_id: executionId, status: "queued" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
  );
}
