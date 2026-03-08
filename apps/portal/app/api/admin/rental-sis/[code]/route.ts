import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rentalSis } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function DELETE(_: NextRequest, context: { params: Promise<{ code: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { code } = await context.params;
  const deleted = await db
    .delete(rentalSis)
    .where(eq(rentalSis.code, code))
    .returning({ code: rentalSis.code });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Rental SI code not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
