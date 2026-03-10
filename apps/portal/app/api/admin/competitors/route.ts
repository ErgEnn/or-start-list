import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitors, sourceCompetitors } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const sourceRows = await db
    .select({
      competitorId: sourceCompetitors.competitorId,
      eolNumber: sourceCompetitors.eolNumber,
      firstName: sourceCompetitors.firstName,
      lastName: sourceCompetitors.lastName,
      gender: sourceCompetitors.gender,
      dob: sourceCompetitors.dob,
      club: sourceCompetitors.club,
      siCard: sourceCompetitors.siCard,
    })
    .from(sourceCompetitors)
    .orderBy(asc(sourceCompetitors.lastName), asc(sourceCompetitors.firstName));

  if (sourceRows.length > 0) {
    const rows = sourceRows.map((row) => ({
      eventId: "source",
      competitorId: row.competitorId,
      eolNumber: row.eolNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      gender: row.gender,
      dob: row.dob,
      club: row.club,
      siCard: row.siCard,
    }));

    return NextResponse.json({ competitors: rows }, { status: 200 });
  }

  // Fallback for older imports that populated the event-scoped competitors table.
  const eventRows = await db
    .select({
      eventId: competitors.eventId,
      competitorId: competitors.competitorId,
      eolNumber: competitors.eolNumber,
      firstName: competitors.firstName,
      lastName: competitors.lastName,
      gender: sourceCompetitors.gender,
      dob: competitors.dob,
      club: competitors.club,
      siCard: competitors.siCard,
    })
    .from(competitors)
    .leftJoin(sourceCompetitors, eq(sourceCompetitors.competitorId, competitors.competitorId))
    .orderBy(asc(competitors.lastName), asc(competitors.firstName));

  return NextResponse.json({ competitors: eventRows }, { status: 200 });
}
