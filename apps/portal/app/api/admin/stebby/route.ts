import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stebbyConfig, stebbyPersons, stebbyTickets } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const configRows = await db
    .select({
      apiKey: stebbyConfig.apiKey,
      lastSyncedAt: stebbyConfig.lastSyncedAt,
    })
    .from(stebbyConfig)
    .where(eq(stebbyConfig.id, "default"))
    .limit(1);

  const config = configRows[0];

  const persons = await db
    .select({
      id: stebbyPersons.id,
      name: stebbyPersons.name,
      idCode: stebbyPersons.idCode,
      ticketCount: sql<number>`count(${stebbyTickets.id})::int`,
    })
    .from(stebbyPersons)
    .leftJoin(stebbyTickets, eq(stebbyPersons.id, stebbyTickets.personId))
    .groupBy(stebbyPersons.id)
    .orderBy(stebbyPersons.name);

  return NextResponse.json({
    config: {
      hasApiKey: !!config,
      lastSyncedAt: config?.lastSyncedAt ?? null,
    },
    persons,
  });
}

type SaveApiKeyBody = { apiKey?: unknown };

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as SaveApiKeyBody;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  await db
    .insert(stebbyConfig)
    .values({ id: "default", apiKey, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: stebbyConfig.id,
      set: { apiKey, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true }, { status: 200 });
}
