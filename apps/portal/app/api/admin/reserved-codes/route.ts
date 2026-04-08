import { asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservedCodes, sourceCompetitors } from "@/lib/db/schema";
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
      county: reservedCodes.county,
      email: reservedCodes.email,
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

type BulkImportBody = {
  codes?: unknown;
};

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as BulkImportBody;
  if (!Array.isArray(body.codes)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const codes = body.codes
    .map((c: unknown) => (typeof c === "string" ? c.trim() : ""))
    .filter((c: string) => c.length > 0);

  if (codes.length === 0) {
    return NextResponse.json({ error: "No valid codes provided" }, { status: 400 });
  }

  const competitors = await db
    .select({
      competitorId: sourceCompetitors.competitorId,
      eolNumber: sourceCompetitors.eolNumber,
      firstName: sourceCompetitors.firstName,
      lastName: sourceCompetitors.lastName,
      dob: sourceCompetitors.dob,
      club: sourceCompetitors.club,
      siCard: sourceCompetitors.siCard,
    })
    .from(sourceCompetitors)
    .where(inArray(sourceCompetitors.eolNumber, codes));

  const competitorByEol = new Map(competitors.map((c) => [c.eolNumber, c]));

  const values = codes.map((code) => {
    const competitor = competitorByEol.get(code);
    return {
      code,
      isReserved: true,
      competitorId: competitor?.competitorId ?? null,
      eolNumber: competitor?.eolNumber ?? null,
      firstName: competitor?.firstName ?? null,
      lastName: competitor?.lastName ?? null,
      dob: competitor?.dob ?? null,
      club: competitor?.club ?? null,
      siCard: competitor?.siCard ?? null,
    };
  });

  const inserted = await db
    .insert(reservedCodes)
    .values(values)
    .onConflictDoNothing({ target: reservedCodes.code })
    .returning({ code: reservedCodes.code });

  return NextResponse.json({ ok: true, importedCount: inserted.length, totalCount: codes.length }, { status: 201 });
}
