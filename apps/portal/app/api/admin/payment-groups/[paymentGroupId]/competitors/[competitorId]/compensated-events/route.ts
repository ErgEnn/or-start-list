import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, paymentGroups, registrations } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

// Lists the events where this payment group's compensation was applied to a competitor.
// "Compensation applied" is recorded on the registration as payment_method = `other(<group name>)`.
export async function GET(
  _: NextRequest,
  context: { params: Promise<{ paymentGroupId: string; competitorId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId, competitorId } = await context.params;

  const group = await db
    .select({ name: paymentGroups.name })
    .from(paymentGroups)
    .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
    .limit(1);

  if (!group[0]) {
    return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
  }

  const compensationTag = `other(${group[0].name})`;

  const rows = await db
    .selectDistinct({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
    })
    .from(registrations)
    .innerJoin(events, eq(registrations.eventId, events.eventId))
    .where(and(eq(registrations.competitorId, competitorId), eq(registrations.paymentMethod, compensationTag)))
    .orderBy(asc(events.startDate), asc(events.name));

  return NextResponse.json({ events: rows }, { status: 200 });
}
