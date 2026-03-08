import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitionGroups } from "@/lib/db/schema";
import { parseMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type UpdateCompetitionGroupBody = {
  name?: unknown;
  gender?: unknown;
  minYear?: unknown;
  maxYear?: unknown;
  price?: unknown;
};

function parseOptionalGender(value: unknown): "male" | "female" | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value === "male" || value === "female") {
    return value;
  }
  return "invalid";
}

function parseOptionalYear(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (!Number.isInteger(value)) {
    return "invalid";
  }
  return value as number;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { name: currentName } = await context.params;
  const body = (await request.json()) as UpdateCompetitionGroupBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const gender = parseOptionalGender(body.gender);
  const minYear = parseOptionalYear(body.minYear);
  const maxYear = parseOptionalYear(body.maxYear);
  const price = parseMoney(body.price);

  if (!name || gender === "invalid" || minYear === "invalid" || maxYear === "invalid" || price === "invalid") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (minYear !== null && maxYear !== null && minYear > maxYear) {
    return NextResponse.json({ error: "Invalid year range" }, { status: 400 });
  }

  const updated = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ name: competitionGroups.name })
      .from(competitionGroups)
      .where(eq(competitionGroups.name, currentName))
      .limit(1);
    if (!existing[0]) {
      return "not_found" as const;
    }

    const conflict = await tx
      .select({ name: competitionGroups.name })
      .from(competitionGroups)
      .where(and(eq(competitionGroups.name, name), ne(competitionGroups.name, currentName)))
      .limit(1);
    if (conflict[0]) {
      return "conflict" as const;
    }

    await tx
      .update(competitionGroups)
      .set({
        name,
        gender,
        minYear,
        maxYear,
        price: toMoneyDb(price),
        updatedAt: new Date(),
      })
      .where(eq(competitionGroups.name, currentName));

    return "ok" as const;
  });

  if (updated === "not_found") {
    return NextResponse.json({ error: "Competition group not found" }, { status: 404 });
  }
  if (updated === "conflict") {
    return NextResponse.json({ error: "Competition group already exists" }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ name: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { name } = await context.params;
  const deleted = await db
    .delete(competitionGroups)
    .where(eq(competitionGroups.name, name))
    .returning({ name: competitionGroups.name });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Competition group not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
