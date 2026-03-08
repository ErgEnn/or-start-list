import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reservedCodes } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type UpdateReservedCodeBody = {
  isReserved?: unknown;
};

export async function PUT(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { code } = await context.params;
  const body = (await request.json()) as UpdateReservedCodeBody;

  if (typeof body.isReserved !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await db
    .update(reservedCodes)
    .set({
      isReserved: body.isReserved,
      updatedAt: new Date(),
    })
    .where(eq(reservedCodes.code, code))
    .returning({ code: reservedCodes.code });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Reserved code not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ code: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { code } = await context.params;
  const deleted = await db
    .delete(reservedCodes)
    .where(eq(reservedCodes.code, code))
    .returning({ code: reservedCodes.code });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Reserved code not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
