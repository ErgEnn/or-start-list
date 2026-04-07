import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapPreferences } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const { competitorId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.courseName === "string") {
    const courseName = body.courseName.trim();
    if (!courseName) {
      return NextResponse.json({ error: "courseName cannot be empty" }, { status: 400 });
    }
    update.courseName = courseName;
  }
  if (typeof body.waterproofMap === "boolean") {
    update.waterproofMap = body.waterproofMap;
  }

  const result = await db
    .update(mapPreferences)
    .set(update)
    .where(eq(mapPreferences.competitorId, competitorId));

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const { competitorId } = await params;

  const result = await db
    .delete(mapPreferences)
    .where(eq(mapPreferences.competitorId, competitorId));

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
