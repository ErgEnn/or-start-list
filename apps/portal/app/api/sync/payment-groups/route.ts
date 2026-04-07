import { paymentGroupsResponseSchema } from "@or/shared";
import { asc, countDistinct, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups, registrations } from "@/lib/db/schema";
import { moneyFromDb } from "@/lib/money";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [groupRows, memberRows, eventCountRows] = await Promise.all([
    db
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverride: paymentGroups.globalPriceOverride,
        sortOrder: paymentGroups.sortOrder,
      })
      .from(paymentGroups)
      .orderBy(desc(paymentGroups.sortOrder), asc(paymentGroups.name), asc(paymentGroups.paymentGroupId)),
    db
      .select({
        paymentGroupId: paymentGroupCompetitors.paymentGroupId,
        competitorId: paymentGroupCompetitors.competitorId,
        priceOverrideCents: paymentGroupCompetitors.priceOverrideCents,
        compensatedEvents: paymentGroupCompetitors.compensatedEvents,
      })
      .from(paymentGroupCompetitors)
      .orderBy(asc(paymentGroupCompetitors.paymentGroupId), asc(paymentGroupCompetitors.competitorId)),
    db
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
    const list = competitorIdsByGroup.get(row.paymentGroupId) ?? [];
    list.push(row.competitorId);
    competitorIdsByGroup.set(row.paymentGroupId, list);

    const members = competitorsByGroup.get(row.paymentGroupId) ?? [];
    members.push({
      competitorId: row.competitorId,
      priceOverrideCents: moneyFromDb(row.priceOverrideCents),
      compensatedEvents: row.compensatedEvents,
      eventsAttended: eventCountMap.get(row.competitorId) ?? 0,
    });
    competitorsByGroup.set(row.paymentGroupId, members);
  }

  const payload = paymentGroupsResponseSchema.parse({
    paymentGroups: groupRows.map((group) => ({
      paymentGroupId: group.paymentGroupId,
      name: group.name,
      colorHex: group.colorHex,
      globalPriceOverride: moneyFromDb(group.globalPriceOverride),
      sortOrder: group.sortOrder,
      competitorIds: competitorIdsByGroup.get(group.paymentGroupId) ?? [],
      competitors: competitorsByGroup.get(group.paymentGroupId) ?? [],
    })),
  });

  return NextResponse.json(payload, { status: 200 });
}
