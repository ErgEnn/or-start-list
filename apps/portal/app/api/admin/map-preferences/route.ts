import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapPreferences, sourceCompetitors } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type MapPreferenceRow = {
  competitorId: string;
  courseName: string;
  waterproofMap: boolean;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
};

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const rows = await db
    .select({
      competitorId: mapPreferences.competitorId,
      courseName: mapPreferences.courseName,
      waterproofMap: mapPreferences.waterproofMap,
      eolNumber: sourceCompetitors.eolNumber,
      firstName: sourceCompetitors.firstName,
      lastName: sourceCompetitors.lastName,
      club: sourceCompetitors.club,
    })
    .from(mapPreferences)
    .leftJoin(sourceCompetitors, eq(mapPreferences.competitorId, sourceCompetitors.competitorId));

  return NextResponse.json({ mapPreferences: rows satisfies MapPreferenceRow[] }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const competitorId = (body.competitorId ?? "").trim();
  const courseName = (body.courseName ?? "").trim();
  const waterproofMap = body.waterproofMap === true;

  if (!competitorId) {
    return NextResponse.json({ error: "competitorId is required" }, { status: 400 });
  }

  await db
    .insert(mapPreferences)
    .values({ competitorId, courseName, waterproofMap })
    .onConflictDoUpdate({
      target: mapPreferences.competitorId,
      set: { courseName, waterproofMap, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true }, { status: 201 });
}
