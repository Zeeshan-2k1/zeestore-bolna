import { execSync } from "node:child_process";

const defaultTestDb =
  "postgresql://postgres:postgres@127.0.0.1:5432/voiceops_test?schema=public";

export default function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDb;
  const directUrl = process.env.TEST_DIRECT_URL ?? databaseUrl;

  try {
    execSync("npx prisma db push --force-reset --accept-data-loss --skip-generate", {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: directUrl,
      },
    });
  } catch {
    console.error(`
[tests] Failed to prepare database.

Ensure Postgres is running:
  npm run db:up

Or use a remote test database:
  TEST_DATABASE_URL="postgresql://..." npm test
`);
    throw new Error("Test database setup failed");
  }
}
