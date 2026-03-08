import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitors, events } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type UpdateEventBody = {
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

export async function GET(_: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { eventId } = await context.params;

  const eventRows = await db
    .select({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.eventId, eventId))
    .limit(1);

  const event = eventRows[0];
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventCompetitors = await db
    .select({
      competitorId: competitors.competitorId,
      eolNumber: competitors.eolNumber,
      firstName: competitors.firstName,
      lastName: competitors.lastName,
      dob: competitors.dob,
      club: competitors.club,
      siCard: competitors.siCard,
    })
    .from(competitors)
    .where(eq(competitors.eventId, eventId))
    .orderBy(asc(competitors.lastName), asc(competitors.firstName));

  return NextResponse.json(
    {
      event,
      competitors: eventCompetitors,
    },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { eventId } = await context.params;
  const body = (await request.json()) as UpdateEventBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!name || !isIsoDate(date)) {
    return NextResponse.json({ error: "name and date are required" }, { status: 400 });
  }

  const updated = await db
    .update(events)
    .set({
      name,
      startDate: date,
    })
    .where(eq(events.eventId, eventId))
    .returning({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
      createdAt: events.createdAt,
    });

  if (!updated[0]) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      event: updated[0],
    },
    { status: 200 },
  );
}
