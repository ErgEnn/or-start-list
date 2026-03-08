import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { parseEolXml } from "@or/eol-import";
import { withTransaction } from "@/lib/db";
import { classes, competitors, events } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const content = await file.text();
  const parsed = parseEolXml(content);

  await withTransaction(async (tx) => {
    await tx
      .insert(events)
      .values({
        eventId: parsed.event.eventId,
        name: parsed.event.name,
        startDate: parsed.event.startDate ?? null,
      })
      .onConflictDoUpdate({
        target: events.eventId,
        set: {
          name: parsed.event.name,
          startDate: parsed.event.startDate ?? null,
        },
      });

    for (const competitor of parsed.competitors) {
      await tx
        .insert(competitors)
        .values({
          eventId: parsed.event.eventId,
          competitorId: competitor.competitorId,
          eolNumber: competitor.eolNumber,
          firstName: competitor.firstName,
          lastName: competitor.lastName,
          dob: competitor.dob ?? null,
          club: competitor.club ?? null,
          siCard: competitor.siCard ?? null,
        })
        .onConflictDoUpdate({
          target: [competitors.eventId, competitors.competitorId],
          set: {
            eolNumber: competitor.eolNumber,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            dob: competitor.dob ?? null,
            club: competitor.club ?? null,
            siCard: competitor.siCard ?? null,
          },
        });
    }

    for (const eventClass of parsed.classes) {
      await tx
        .insert(classes)
        .values({
          eventId: parsed.event.eventId,
          classId: eventClass.classId,
          name: eventClass.name,
          shortName: eventClass.shortName,
        })
        .onConflictDoUpdate({
          target: [classes.eventId, classes.classId],
          set: {
            name: eventClass.name,
            shortName: eventClass.shortName,
          },
        });
    }

    await tx.execute(sql`
      INSERT INTO event_snapshot_versions (event_id, version, generated_at)
      VALUES (
        ${parsed.event.eventId},
        COALESCE((SELECT MAX(version) + 1 FROM event_snapshot_versions WHERE event_id = ${parsed.event.eventId}), 1),
        NOW()
      )
    `);
  });

  return NextResponse.json({
    ok: true,
    imported: {
      eventId: parsed.event.eventId,
      competitors: parsed.competitors.length,
      classes: parsed.classes.length,
      courses: parsed.courses.length,
    },
    warnings: parsed.errors,
  });
}
