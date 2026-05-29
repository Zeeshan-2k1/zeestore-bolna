import path from "node:path";
import { defineConfig } from "vitest/config";

const defaultTestDb =
  "postgresql://postgres:postgres@127.0.0.1:5432/voiceops_test?schema=public";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? defaultTestDb,
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? defaultTestDb,
      DIRECT_URL: process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL ?? defaultTestDb,
      PUBLIC_URL: "http://localhost:3000",
      BOLNA_API_KEY: "test-bolna-api-key",
      BOLNA_AGENT_ID_LEADS: "test-agent-leads",
      BOLNA_AGENT_ID_COD: "test-agent-cod",
      BOLNA_AGENT_ID_NDR: "test-agent-ndr",
      CRON_SECRET: "test-cron-secret",
      PREPAID_NDR_MIN_FORCED_FAILURES: "5",
      PREPAID_NDR_FAILURE_RATE: "0.25",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
