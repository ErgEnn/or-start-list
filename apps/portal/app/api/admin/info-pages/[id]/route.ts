import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { infoPages } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { title?: unknown; content?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!title) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await db
    .update(infoPages)
    .set({ title, content, updatedAt: new Date() })
    .where(eq(infoPages.id, id))
    .returning({ id: infoPages.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Info page not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const deleted = await db
    .delete(infoPages)
    .where(eq(infoPages.id, id))
    .returning({ id: infoPages.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Info page not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
