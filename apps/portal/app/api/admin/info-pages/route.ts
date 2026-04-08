import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { infoPages } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const rows = await db
    .select({
      id: infoPages.id,
      title: infoPages.title,
      content: infoPages.content,
      createdAt: infoPages.createdAt,
      updatedAt: infoPages.updatedAt,
    })
    .from(infoPages)
    .orderBy(desc(infoPages.updatedAt));

  return NextResponse.json({ infoPages: rows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as { title?: unknown; content?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!title) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await db.insert(infoPages).values({ id, title, content });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
