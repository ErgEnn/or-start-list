import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitionGroups } from "@/lib/db/schema";
import { moneyFromDb, parseMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type CreateCompetitionGroupBody = {
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

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const rows = await db
    .select({
      name: competitionGroups.name,
      gender: competitionGroups.gender,
      minYear: competitionGroups.minYear,
      maxYear: competitionGroups.maxYear,
      price: competitionGroups.price,
      createdAt: competitionGroups.createdAt,
      updatedAt: competitionGroups.updatedAt,
    })
    .from(competitionGroups)
    .orderBy(asc(competitionGroups.name));

  return NextResponse.json(
    {
      competitionGroups: rows.map((row) => ({
        ...row,
        price: moneyFromDb(row.price) ?? 0,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as CreateCompetitionGroupBody;

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

  const inserted = await db
    .insert(competitionGroups)
    .values({
      name,
      gender,
      minYear,
      maxYear,
      price: toMoneyDb(price),
    })
    .onConflictDoNothing({ target: competitionGroups.name })
    .returning({ name: competitionGroups.name });

  if (inserted.length === 0) {
    return NextResponse.json({ error: "Competition group already exists" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, name }, { status: 201 });
}
