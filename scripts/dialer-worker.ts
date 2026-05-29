/**
 * Background auto-dialer — runs without a browser.
 *
 * Usage: npm run dialer:worker
 * Requires DATABASE_URL and Bolna env vars (same as the Next.js app).
 */
import { runCodDialerTick, runDialerTick, runLeadDialerTick } from "../src/lib/dialer-runner";
import { db } from "../src/lib/db";
import { DIALER_POLL_MS } from "../src/lib/refresh-intervals";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function logTick(label: string, tick: Awaited<ReturnType<typeof runDialerTick>>) {
  const ts = new Date().toISOString();
  if (!tick.ran) {
    console.log(`[${ts}] ${label} idle (${tick.reason})`);
    return;
  }
  const r = tick.result;
  const parts = [
    `triggered=${r.triggered}`,
    `active=${r.activeCalls}`,
    r.waitingForBatch ? "waiting-batch" : null,
    r.waitingForCallDelay ? "waiting-call" : null,
    r.errors.length ? `errors=${r.errors.length}` : null,
  ].filter(Boolean);
  console.log(`[${ts}] ${label} tick · ${parts.join(" · ")}`);
}

async function shutdown(signal: string) {
  console.log(`\n[dialer-worker] ${signal} — shutting down`);
  await db.$disconnect();
  process.exit(0);
}

async function main() {
  console.log(
    `[dialer-worker] started · polling every ${DIALER_POLL_MS / 1000}s · Ctrl+C to stop`,
  );

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  for (;;) {
    try {
      const ndr = await runDialerTick();
      const cod = await runCodDialerTick();
      const leads = await runLeadDialerTick();
      logTick("ndr", ndr);
      logTick("cod", cod);
      logTick("leads", leads);
    } catch (err) {
      console.error("[dialer-worker] tick failed:", err);
    }
    await sleep(DIALER_POLL_MS);
  }
}

main().catch((err) => {
  console.error("[dialer-worker] fatal:", err);
  void db.$disconnect().finally(() => process.exit(1));
});
