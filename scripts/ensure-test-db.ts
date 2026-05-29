/**
 * Ensures Postgres is reachable before vitest globalSetup runs prisma db push.
 * Starts Docker Compose when local Postgres is down.
 */
import { execSync } from "node:child_process";
import net from "node:net";

const defaultTestDb =
  "postgresql://postgres:postgres@127.0.0.1:5432/voiceops_test?schema=public";

function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? defaultTestDb;
}

function parseHostPort(url: string): { host: string; port: number } {
  const parsed = new URL(url.replace(/^postgresql:/, "http:"));
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : 5432,
  };
}

function canConnect(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureTestDatabaseExists() {
  try {
    execSync(
      'docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE voiceops_test"',
      { stdio: "ignore" },
    );
  } catch {
    // Database already exists.
  }
}

async function main() {
  const url = testDatabaseUrl();
  const { host, port } = parseHostPort(url);

  if (await canConnect(host, port)) {
    return;
  }

  console.log("[ensure-test-db] Postgres not reachable — starting Docker Compose…");

  try {
    run("docker compose up -d --wait");
  } catch {
    console.error(`
[ensure-test-db] Could not start Postgres.

Tests need PostgreSQL at ${host}:${port}.

Options:
  1. Start Docker Desktop, then run:  npm run db:up
  2. Point tests at Neon:             TEST_DATABASE_URL="postgresql://..." npm test
  3. Skip tests if you only need the app running locally.

`);
    process.exit(1);
  }

  for (let i = 0; i < 20; i++) {
    if (await canConnect(host, port)) {
      ensureTestDatabaseExists();
      console.log("[ensure-test-db] Postgres is ready.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.error("[ensure-test-db] Postgres still unreachable after docker compose up.");
  process.exit(1);
}

main().catch((err) => {
  console.error("[ensure-test-db]", err);
  process.exit(1);
});
