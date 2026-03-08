import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservedCodes } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type CreateReservedCodeBody = {
  code?: unknown;
};

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const rows = await db
    .select({
      code: reservedCodes.code,
      isReserved: reservedCodes.isReserved,
      competitorId: reservedCodes.competitorId,
      eolNumber: reservedCodes.eolNumber,
      firstName: reservedCodes.firstName,
      lastName: reservedCodes.lastName,
      dob: reservedCodes.dob,
      club: reservedCodes.club,
      siCard: reservedCodes.siCard,
      createdAt: reservedCodes.createdAt,
      updatedAt: reservedCodes.updatedAt,
    })
    .from(reservedCodes)
    .orderBy(asc(reservedCodes.code));

  return NextResponse.json({ reservedCodes: rows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as CreateReservedCodeBody;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inserted = await db
    .insert(reservedCodes)
    .values({
      code,
      isReserved: true,
    })
    .onConflictDoNothing({ target: reservedCodes.code })
    .returning({ code: reservedCodes.code });

  if (inserted.length === 0) {
    return NextResponse.json({ error: "Code already exists" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, code }, { status: 201 });
}
