import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { OutboxItem, PullResponse } from "@or/shared";
import type { DbLike } from "./db";
import {
  classes,
  competitors,
  courses,
  eventSnapshotVersions,
  events,
  pricingRules,
  quickFilters,
  registrations,
  reservedCodes,
  sourceCompetitors,
} from "./db/schema";
import { moneyFromDb, toMoneyDb } from "./money";

export async function applyOutboxItems(client: DbLike, deviceId: string, items: OutboxItem[]) {
  let acceptedCount = 0;
  let ackSeqInclusive = 0;
  const rejected: Array<{ localSeq: number; code: string }> = [];

  for (const item of items) {
    if (item.type === "registration_created") {
      const payload = item.payload;
      const inserted = await client
        .insert(registrations)
        .values({
          registrationId: payload.registrationId,
          deviceId,
          eventId: payload.eventId,
          competitorId: payload.competitorId,
          courseId: payload.courseId,
          competitionGroupName: payload.competitionGroupName,
          priceCents: toMoneyDb(payload.priceCents / 100),
          createdAtDevice: new Date(payload.createdAtDevice),
          localSeq: payload.localSeq,
        })
        .onConflictDoNothing({ target: [registrations.deviceId, registrations.localSeq] })
        .returning({ id: registrations.registrationId });

      if (inserted.length > 0) {
        acceptedCount += 1;
      }
      ackSeqInclusive = Math.max(ackSeqInclusive, payload.localSeq);
      continue;
    }

    if (item.type === "registration_cleared") {
      const payload = item.payload;
      await client
        .delete(registrations)
        .where(and(eq(registrations.eventId, payload.eventId), eq(registrations.competitorId, payload.competitorId)));
      acceptedCount += 1;
      ackSeqInclusive = Math.max(ackSeqInclusive, payload.localSeq);
      continue;
    }

    if (item.type === "reserved_code_claimed") {
      const payload = item.payload;
      const isManualEol = payload.isManualEol === true;
      const now = new Date();

      if (!isManualEol) {
        const existing = await client
          .select({ isReserved: reservedCodes.isReserved })
          .from(reservedCodes)
          .where(eq(reservedCodes.code, payload.code))
          .limit(1);

        if (!existing[0] || !existing[0].isReserved) {
          rejected.push({ localSeq: item.localSeq, code: "reserved_code_already_claimed" });
          ackSeqInclusive = Math.max(ackSeqInclusive, item.localSeq);
          continue;
        }

        await client
          .update(reservedCodes)
          .set({
            isReserved: false,
            competitorId: payload.competitorId,
            eolNumber: payload.eolNumber,
            firstName: payload.firstName,
            lastName: payload.lastName,
            dob: payload.dob ?? null,
            club: payload.club ?? null,
            siCard: payload.siCard ?? null,
            updatedAt: now,
          })
          .where(eq(reservedCodes.code, payload.code));
      }

      const payloadHash = createHash("sha256")
        .update(
          [
            payload.competitorId,
            payload.eolNumber,
            payload.firstName,
            payload.lastName,
            payload.gender ?? "",
            payload.dob ?? "",
            payload.club ?? "",
            payload.siCard ?? "",
          ].join("|"),
        )
        .digest("hex");

      await client
        .insert(sourceCompetitors)
        .values({
          competitorId: payload.competitorId,
          eolNumber: payload.eolNumber,
          firstName: payload.firstName,
          lastName: payload.lastName,
          gender: payload.gender ?? null,
          dob: payload.dob ?? null,
          club: payload.club ?? null,
          siCard: payload.siCard ?? null,
          payloadHash,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: sourceCompetitors.eolNumber,
          set: {
            competitorId: sql`excluded.competitor_id`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            gender: sql`excluded.gender`,
            dob: sql`excluded.dob`,
            club: sql`excluded.club`,
            siCard: sql`excluded.si_card`,
            payloadHash: sql`excluded.payload_hash`,
            version: sql`${sourceCompetitors.version} + 1`,
            updatedAt: now,
          },
        });

      acceptedCount += 1;
      ackSeqInclusive = Math.max(ackSeqInclusive, item.localSeq);
      continue;
    }
  }

  return { acceptedCount, ackSeqInclusive, rejected };
}

export async function loadEventDataset(
  client: DbLike,
  eventId: string,
  sinceVersion: number,
): Promise<PullResponse> {
  const versionResult = await client
    .select({ version: sql<number>`coalesce(max(${eventSnapshotVersions.version}), 0)` })
    .from(eventSnapshotVersions)
    .where(eq(eventSnapshotVersions.eventId, eventId));
  const version = versionResult[0]?.version ?? 0;
  const mode = sinceVersion >= version && version > 0 ? "delta" : "snapshot";

  const [eventRows, competitorRows, classRows, courseRows, filterRows, pricingRows, registrationRows] = await Promise.all([
    client
      .select({
        eventId: events.eventId,
        name: events.name,
        startDate: events.startDate,
      })
      .from(events)
      .where(eq(events.eventId, eventId))
      .limit(1),
    client
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
      .orderBy(asc(competitors.lastName), asc(competitors.firstName)),
    client
      .select({
        classId: classes.classId,
        eventId: classes.eventId,
        name: classes.name,
        shortName: classes.shortName,
      })
      .from(classes)
      .where(eq(classes.eventId, eventId))
      .orderBy(asc(classes.shortName)),
    client
      .select({
        courseId: courses.courseId,
        eventId: courses.eventId,
        classId: courses.classId,
        name: courses.name,
        priceCents: courses.priceCents,
      })
      .from(courses)
      .where(eq(courses.eventId, eventId))
      .orderBy(asc(courses.name)),
    client
      .select({
        filterId: quickFilters.filterId,
        eventId: quickFilters.eventId,
        name: quickFilters.name,
        queryDefinition: quickFilters.queryDefinition,
      })
      .from(quickFilters)
      .where(eq(quickFilters.eventId, eventId))
      .orderBy(asc(quickFilters.name)),
    client
      .select({
        pricingRuleId: pricingRules.pricingRuleId,
        eventId: pricingRules.eventId,
        ruleName: pricingRules.ruleName,
        payload: pricingRules.payload,
      })
      .from(pricingRules)
      .where(eq(pricingRules.eventId, eventId))
      .orderBy(asc(pricingRules.ruleName)),
    client
      .select({
        registrationId: registrations.registrationId,
        deviceId: registrations.deviceId,
        eventId: registrations.eventId,
        competitorId: registrations.competitorId,
        courseId: registrations.courseId,
        competitionGroupName: registrations.competitionGroupName,
        priceCents: registrations.priceCents,
        createdAtDevice: registrations.createdAtDevice,
        localSeq: registrations.localSeq,
      })
      .from(registrations)
      .where(eq(registrations.eventId, eventId))
      .orderBy(desc(registrations.createdAtDevice), desc(registrations.receivedAt)),
  ]);

  return {
    version,
    mode,
    data: {
      event: eventRows[0],
      competitors: competitorRows.map((item: any) => ({
        ...item,
        dob: item.dob ?? undefined,
        club: item.club ?? undefined,
        siCard: item.siCard ?? undefined,
      })),
      classes: classRows,
      courses: courseRows.map((item: any) => ({
        ...item,
        priceCents: Math.round((moneyFromDb(item.priceCents) ?? 0) * 100),
      })),
      filters: filterRows,
      pricing: pricingRows.map((item: any) => ({
        ...item,
        payload: (item.payload ?? {}) as Record<string, unknown>,
      })),
      registrations: registrationRows.map((item: any) => ({
        ...item,
        competitionGroupName: item.competitionGroupName,
        priceCents: Math.round((moneyFromDb(item.priceCents) ?? 0) * 100),
        createdAtDevice: new Date(item.createdAtDevice).toISOString(),
      })),
    },
  };
}
