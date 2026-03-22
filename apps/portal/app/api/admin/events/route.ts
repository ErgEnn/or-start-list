import { randomBytes } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, registrations } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type CreateEventBody = {
  name?: unknown;
  date?: unknown;
};

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function buildEventId(name: string, date: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const dateSegment = date.replaceAll("-", "");
  const randomSegment = randomBytes(3).toString("hex");
  return `evt_${dateSegment}_${slug || "event"}_${randomSegment}`;
}

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const rows = await db
    .select({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
      createdAt: events.createdAt,
      competitorsCount: sql<number>`cast(count(${registrations.registrationId}) as int)`,
    })
    .from(events)
    .leftJoin(registrations, eq(registrations.eventId, events.eventId))
    .groupBy(events.eventId, events.name, events.startDate, events.createdAt)
    .orderBy(asc(events.startDate), asc(events.name));

  return NextResponse.json({ events: rows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as CreateEventBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!name || !isIsoDate(date)) {
    return NextResponse.json({ error: "name and date are required" }, { status: 400 });
  }

  let created = null as { eventId: string; name: string; startDate: string | null; createdAt: Date } | null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const eventId = buildEventId(name, date);
    const inserted = await db
      .insert(events)
      .values({
        eventId,
        name,
        startDate: date,
      })
      .onConflictDoNothing()
      .returning({
        eventId: events.eventId,
        name: events.name,
        startDate: events.startDate,
        createdAt: events.createdAt,
      });

    if (inserted[0]) {
      created = inserted[0];
      break;
    }
  }

  if (!created) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: created }, { status: 201 });
}
