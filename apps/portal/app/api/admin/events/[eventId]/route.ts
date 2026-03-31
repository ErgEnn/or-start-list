import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitors, courses, events, paymentGroupCompetitors, paymentGroups, registrations, sourceCompetitors } from "@/lib/db/schema";
import { moneyFromDb } from "@/lib/money";
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
      registrationId: registrations.registrationId,
      competitorId: registrations.competitorId,
      eolNumber: sql<string | null>`coalesce(${sourceCompetitors.eolNumber}, ${competitors.eolNumber})`,
      firstName: sql<string | null>`coalesce(${sourceCompetitors.firstName}, ${competitors.firstName})`,
      lastName: sql<string | null>`coalesce(${sourceCompetitors.lastName}, ${competitors.lastName})`,
      dob: sql<string | null>`coalesce(${sourceCompetitors.dob}, ${competitors.dob})`,
      club: sql<string | null>`coalesce(${sourceCompetitors.club}, ${competitors.club})`,
      siCard: sql<string | null>`coalesce(${sourceCompetitors.siCard}, ${competitors.siCard})`,
      courseId: registrations.courseId,
      competitionGroupName: registrations.competitionGroupName,
      courseName: courses.name,
      price: registrations.priceCents,
      pricePaid: registrations.paidPriceCents,
      paymentMethod: registrations.paymentMethod,
      deviceId: registrations.deviceId,
      createdAtDevice: registrations.createdAtDevice,
    })
    .from(registrations)
    .leftJoin(
      competitors,
      and(
        eq(competitors.eventId, registrations.eventId),
        eq(competitors.competitorId, registrations.competitorId),
      ),
    )
    .leftJoin(sourceCompetitors, eq(sourceCompetitors.competitorId, registrations.competitorId))
    .leftJoin(
      courses,
      and(
        eq(courses.eventId, registrations.eventId),
        eq(courses.courseId, registrations.courseId),
      ),
    )
    .where(eq(registrations.eventId, eventId))
    .orderBy(
      desc(registrations.createdAtDevice),
      asc(sql`coalesce(${sourceCompetitors.lastName}, ${competitors.lastName})`),
      asc(sql`coalesce(${sourceCompetitors.firstName}, ${competitors.firstName})`),
    );

  const competitorRows = eventCompetitors.map((row) => ({
    ...row,
    price: moneyFromDb(row.price),
    pricePaid: moneyFromDb(row.pricePaid),
  }));

  const competitorIds = eventCompetitors.map((r) => r.competitorId);

  const pgMemberships =
    competitorIds.length > 0
      ? await db
          .select({
            paymentGroupName: paymentGroups.name,
            competitorId: paymentGroupCompetitors.competitorId,
          })
          .from(paymentGroupCompetitors)
          .innerJoin(paymentGroups, eq(paymentGroups.paymentGroupId, paymentGroupCompetitors.paymentGroupId))
          .where(inArray(paymentGroupCompetitors.competitorId, competitorIds))
      : [];

  const paymentGroupMap: Record<string, string[]> = {};
  for (const m of pgMemberships) {
    if (!paymentGroupMap[m.paymentGroupName]) {
      paymentGroupMap[m.paymentGroupName] = [];
    }
    paymentGroupMap[m.paymentGroupName].push(m.competitorId);
  }

  return NextResponse.json(
    {
      event,
      competitors: competitorRows,
      paymentGroups: paymentGroupMap,
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
