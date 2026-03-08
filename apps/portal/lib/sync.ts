import { asc, eq, sql } from "drizzle-orm";
import type { OutboxItem, PullResponse } from "@or/shared";
import type { DbLike } from "./db";
import { classes, competitors, courses, eventSnapshotVersions, pricingRules, quickFilters, registrations } from "./db/schema";
import { moneyFromDb, toMoneyDb } from "./money";

export async function applyOutboxItems(client: DbLike, deviceId: string, items: OutboxItem[]) {
  let acceptedCount = 0;
  let ackSeqInclusive = 0;
  const rejected: Array<{ localSeq: number; code: string }> = [];

  for (const item of items) {
    if (item.type !== "registration_created") {
      rejected.push({ localSeq: item.localSeq, code: "UNSUPPORTED_ITEM_TYPE" });
      continue;
    }
    const payload = item.payload;
    const inserted = await client
      .insert(registrations)
      .values({
        registrationId: payload.registrationId,
        deviceId,
        eventId: payload.eventId,
        competitorId: payload.competitorId,
        courseId: payload.courseId,
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

  const [competitorRows, classRows, courseRows, filterRows, pricingRows] = await Promise.all([
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
  ]);

  return {
    version,
    mode,
    data: {
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
    },
  };
}
