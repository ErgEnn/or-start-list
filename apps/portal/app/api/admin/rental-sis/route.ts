import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rentalSis } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type CreateRentalSiBody = {
  code?: unknown;
};

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const rows = await db
    .select({
      code: rentalSis.code,
      createdAt: rentalSis.createdAt,
      updatedAt: rentalSis.updatedAt,
    })
    .from(rentalSis)
    .orderBy(asc(rentalSis.code));

  return NextResponse.json({ rentalSis: rows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as CreateRentalSiBody;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inserted = await db
    .insert(rentalSis)
    .values({ code })
    .onConflictDoNothing({ target: rentalSis.code })
    .returning({ code: rentalSis.code });

  if (inserted.length === 0) {
    return NextResponse.json({ error: "SI code already exists" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, code }, { status: 201 });
}
