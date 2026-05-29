import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export function apiErrorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const needsMigration =
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022");

  console.error(fallback, err);

  return NextResponse.json(
    {
      error: needsMigration
        ? "Database schema is out of date. Run: npx prisma db push"
        : message,
      needsMigration,
    },
    { status: 500 },
  );
}
