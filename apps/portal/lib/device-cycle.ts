import { asc, countDistinct, desc, eq } from "drizzle-orm";
import type {
  CompetitionGroupsResponse,
  DeviceSyncCycleRequest,
  DeviceSyncCycleResponse,
  MapPreferencesResponse,
  PaymentGroupsResponse,
} from "@or/shared";
import { competitionGroupsResponseSchema, mapPreferencesResponseSchema, paymentGroupsResponseSchema } from "@or/shared";
import { getSourceCompetitorChanges } from "@/lib/source-competitors";
import type { DbLike } from "./db";
import { competitionGroups, events, infoPages, mapPreferences, paymentGroupCompetitors, paymentGroups, registrations, reservedCodes } from "./db/schema";
import { moneyFromDb } from "./money";
import { applyOutboxItems, loadEventDataset } from "./sync";

async function loadEventsSnapshot(client: DbLike) {
  return client
    .select({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
    })
    .from(events)
    .orderBy(asc(events.startDate), asc(events.name));
}

async function loadPaymentGroupsSnapshot(client: DbLike): Promise<PaymentGroupsResponse["paymentGroups"]> {
  const [groupRows, memberRows, eventCountRows] = await Promise.all([
    client
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverride: paymentGroups.globalPriceOverride,
        sortOrder: paymentGroups.sortOrder,
      })
      .from(paymentGroups)
      .orderBy(desc(paymentGroups.sortOrder), asc(paymentGroups.name), asc(paymentGroups.paymentGroupId)),
    client
      .select({
        paymentGroupId: paymentGroupCompetitors.paymentGroupId,
        competitorId: paymentGroupCompetitors.competitorId,
        priceOverrideCents: paymentGroupCompetitors.priceOverrideCents,
        compensatedEvents: paymentGroupCompetitors.compensatedEvents,
      })
      .from(paymentGroupCompetitors)
      .orderBy(asc(paymentGroupCompetitors.paymentGroupId), asc(paymentGroupCompetitors.competitorId)),
    client
      .select({
        competitorId: registrations.competitorId,
        eventCount: countDistinct(registrations.eventId).mapWith(Number),
      })
      .from(registrations)
      .groupBy(registrations.competitorId),
  ]);

  const eventCountMap = new Map<string, number>();
  for (const row of eventCountRows) {
    eventCountMap.set(row.competitorId, row.eventCount);
  }

  const competitorIdsByGroup = new Map<string, string[]>();
  const competitorsByGroup = new Map<string, Array<{ competitorId: string; priceOverrideCents: number | null; compensatedEvents: number | null; eventsAttended: number }>>();
  for (const row of memberRows) {
    const current = competitorIdsByGroup.get(row.paymentGroupId) ?? [];
    current.push(row.competitorId);
    competitorIdsByGroup.set(row.paymentGroupId, current);

    const competitorRows = competitorsByGroup.get(row.paymentGroupId) ?? [];
    competitorRows.push({
      competitorId: row.competitorId,
      priceOverrideCents: moneyFromDb(row.priceOverrideCents),
      compensatedEvents: row.compensatedEvents,
      eventsAttended: eventCountMap.get(row.competitorId) ?? 0,
    });
    competitorsByGroup.set(row.paymentGroupId, competitorRows);
  }

  return paymentGroupsResponseSchema.parse({
    paymentGroups: groupRows.map((group: { paymentGroupId: string; name: string; colorHex: string | null; globalPriceOverride: unknown; sortOrder: number }) => ({
      paymentGroupId: group.paymentGroupId,
      name: group.name,
      colorHex: group.colorHex,
      globalPriceOverride: moneyFromDb(group.globalPriceOverride),
      sortOrder: group.sortOrder,
      competitorIds: competitorIdsByGroup.get(group.paymentGroupId) ?? [],
      competitors: competitorsByGroup.get(group.paymentGroupId) ?? [],
    })),
  }).paymentGroups;
}

async function loadCompetitionGroupsSnapshot(client: DbLike): Promise<CompetitionGroupsResponse["competitionGroups"]> {
  const rows = await client
    .select({
      name: competitionGroups.name,
      gender: competitionGroups.gender,
      minYear: competitionGroups.minYear,
      maxYear: competitionGroups.maxYear,
      price: competitionGroups.price,
    })
    .from(competitionGroups)
    .orderBy(asc(competitionGroups.name));

  return competitionGroupsResponseSchema.parse({
    competitionGroups: rows.map((row: { name: string; gender: string | null; minYear: number | null; maxYear: number | null; price: unknown }) => ({
      name: row.name,
      gender: (row.gender as "male" | "female" | null) ?? null,
      minYear: row.minYear,
      maxYear: row.maxYear,
      priceCents: Math.round((moneyFromDb(row.price) ?? 0) * 100),
    })),
  }).competitionGroups;
}

async function loadMapPreferencesSnapshot(client: DbLike): Promise<MapPreferencesResponse["mapPreferences"]> {
  const rows = await client
    .select({
      competitorId: mapPreferences.competitorId,
      courseName: mapPreferences.courseName,
      waterproofMap: mapPreferences.waterproofMap,
    })
    .from(mapPreferences);

  return mapPreferencesResponseSchema.parse({ mapPreferences: rows }).mapPreferences;
}

async function loadReservedCodesSnapshot(client: DbLike) {
  const rows = await client
    .select({
      code: reservedCodes.code,
      isReserved: reservedCodes.isReserved,
    })
    .from(reservedCodes)
    .where(eq(reservedCodes.isReserved, true))
    .orderBy(asc(reservedCodes.code));
  return rows.map((row: { code: string; isReserved: boolean }) => ({ code: row.code, isReserved: true as const }));
}

async function loadInfoPagesSnapshot(client: DbLike) {
  const rows = await client
    .select({
      id: infoPages.id,
      title: infoPages.title,
      content: infoPages.content,
      updatedAt: infoPages.updatedAt,
    })
    .from(infoPages)
    .orderBy(asc(infoPages.title));
  return rows.map((row: { id: string; title: string; content: string; updatedAt: Date }) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function loadDeviceCycle(
  client: DbLike,
  deviceId: string,
  request: DeviceSyncCycleRequest,
): Promise<DeviceSyncCycleResponse> {
  const pushResult = await applyOutboxItems(client, deviceId, request.pendingRegistrations);
  const [eventRows, paymentGroupRows, mapPreferenceRows, competitionGroupRows, competitorDelta, reservedCodeRows, infoPageRows] = await Promise.all([
    loadEventsSnapshot(client),
    loadPaymentGroupsSnapshot(client),
    loadMapPreferencesSnapshot(client),
    loadCompetitionGroupsSnapshot(client),
    getSourceCompetitorChanges(request.sinceCompetitorVersion),
    loadReservedCodesSnapshot(client),
    loadInfoPagesSnapshot(client),
  ]);

  const eventSnapshots = [];
  for (const event of eventRows) {
    const clientVersion = request.eventVersions[event.eventId] ?? 0;
    const dataset = await loadEventDataset(client, event.eventId, clientVersion);
    if (dataset.mode === "snapshot" || dataset.version > clientVersion) {
      eventSnapshots.push(dataset);
    }
  }

  return {
    ackSeqInclusive: pushResult.ackSeqInclusive,
    acceptedCount: pushResult.acceptedCount,
    rejected: pushResult.rejected,
    events: eventRows,
    paymentGroups: paymentGroupRows,
    mapPreferences: mapPreferenceRows,
    competitionGroups: competitionGroupRows,
    competitorDelta,
    eventSnapshots,
    reservedCodes: reservedCodeRows,
    infoPages: infoPageRows,
  };
}
