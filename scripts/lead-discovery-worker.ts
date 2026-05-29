/**
 * Lead discovery background worker.
 *
 * Usage:
 * - npm run leads:worker
 * - npm run leads:worker -- --interval=15 --limit=30
 */
import { db } from "../src/lib/db";
import { runLeadDiscovery } from "../src/lib/lead-monitor";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readArg(name: string): string | undefined {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return flag?.split("=")[1];
}

function readInt(name: string, fallback: number): number {
  const fromArg = readArg(name);
  const raw = fromArg ?? process.env[name.toUpperCase()];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function shutdown(signal: string) {
  console.log(`\n[leads-worker] ${signal} — shutting down`);
  await db.$disconnect();
  process.exit(0);
}

async function main() {
  const intervalSec = readInt("interval", 10);
  const limit = readInt("limit", 20);
  const intervalMs = intervalSec * 1000;

  console.log(
    `[leads-worker] started · every ${intervalSec}s · top ${limit} leads`,
  );

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  for (;;) {
    try {
      const tick = await runLeadDiscovery(limit);
      const top = tick.leads
        .slice(0, 5)
        .map((l) => `${l.name}(${l.score})`)
        .join(", ");
      console.log(
        `[${new Date().toISOString()}] leads=${tick.totalPotential} hot=${tick.hot} warm=${tick.warm} cold=${tick.cold}${top ? ` · top: ${top}` : ""}`,
      );
    } catch (err) {
      console.error("[leads-worker] tick failed:", err);
    }
    await sleep(intervalMs);
  }
}

main().catch((err) => {
  console.error("[leads-worker] fatal:", err);
  void db.$disconnect().finally(() => process.exit(1));
});
