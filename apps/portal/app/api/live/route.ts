import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, registrations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function todayInTallinn() {
  // "en-CA" formats as YYYY-MM-DD, matching the `date` column representation.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tallinn" }).format(new Date());
}

export async function GET() {
  try {
    const today = todayInTallinn();

    const [event] = await db
      .select({ eventId: events.eventId, name: events.name })
      .from(events)
      .where(eq(events.startDate, today))
      .orderBy(asc(events.createdAt), asc(events.eventId))
      .limit(1);

    if (!event) {
      return NextResponse.json({ count: 0, eventName: null, eventId: null });
    }

    const [row] = await db
      .select({
        count: sql<number>`cast(count(${registrations.registrationId}) as int)`,
      })
      .from(registrations)
      .where(eq(registrations.eventId, event.eventId));

    return NextResponse.json({
      count: row?.count ?? 0,
      eventName: event.name,
      eventId: event.eventId,
    });
  } catch {
    return NextResponse.json({ count: 0, eventName: null, eventId: null, error: true });
  }
}
