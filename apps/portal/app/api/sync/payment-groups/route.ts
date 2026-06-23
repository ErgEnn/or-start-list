import { paymentGroupsResponseSchema } from "@or/shared";
import { asc, countDistinct, desc, like } from "drizzle-orm";
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

  const [groupRows, memberRows, eventCountRows, compensationCountRows] = await Promise.all([
    db
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverride: paymentGroups.globalPriceOverride,
        autoFromRegistrations: paymentGroups.autoFromRegistrations,
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
    // Total distinct events per competitor — used for "auto from registrations" group membership.
    db
      .select({
        competitorId: registrations.competitorId,
        eventCount: countDistinct(registrations.eventId).mapWith(Number),
      })
      .from(registrations)
      .groupBy(registrations.competitorId),
    // Compensated events used per (competitor, payment group): distinct events where the group
    // paid, recorded as payment_method = `other(<group name>)`.
    db
      .select({
        competitorId: registrations.competitorId,
        paymentMethod: registrations.paymentMethod,
        eventCount: countDistinct(registrations.eventId).mapWith(Number),
      })
      .from(registrations)
      .where(like(registrations.paymentMethod, "other(%"))
      .groupBy(registrations.competitorId, registrations.paymentMethod),
  ]);

  const compensationCountMap = new Map<string, number>();
  for (const row of compensationCountRows) {
    compensationCountMap.set(`${row.competitorId}|${row.paymentMethod}`, row.eventCount);
  }

  const competitorIdsByGroup = new Map<string, string[]>();
  const competitorsByGroup = new Map<string, Array<{ competitorId: string; priceOverrideCents: number | null; compensatedEvents: number | null }>>();
  for (const row of memberRows) {
    const list = competitorIdsByGroup.get(row.paymentGroupId) ?? [];
    list.push(row.competitorId);
    competitorIdsByGroup.set(row.paymentGroupId, list);

    const members = competitorsByGroup.get(row.paymentGroupId) ?? [];
    members.push({
      competitorId: row.competitorId,
      priceOverrideCents: moneyFromDb(row.priceOverrideCents),
      compensatedEvents: row.compensatedEvents,
    });
    competitorsByGroup.set(row.paymentGroupId, members);
  }

  // An "auto from registrations" group dynamically contains everyone who has competed in any
  // previous event, with no price overrides. Its membership is resolved here from the distinct
  // registration set instead of from paymentGroupCompetitors.
  const autoCompetitorIds = eventCountRows.map((row) => row.competitorId);
  const autoMembers = eventCountRows.map((row) => ({
    competitorId: row.competitorId,
    priceOverrideCents: null,
    compensatedEvents: null,
    eventsAttended: row.eventCount,
  }));

  const payload = paymentGroupsResponseSchema.parse({
    paymentGroups: groupRows.map((group) => ({
      paymentGroupId: group.paymentGroupId,
      name: group.name,
      colorHex: group.colorHex,
      globalPriceOverride: group.autoFromRegistrations ? null : moneyFromDb(group.globalPriceOverride),
      sortOrder: group.sortOrder,
      competitorIds: group.autoFromRegistrations ? autoCompetitorIds : competitorIdsByGroup.get(group.paymentGroupId) ?? [],
      competitors: group.autoFromRegistrations
        ? autoMembers
        : (competitorsByGroup.get(group.paymentGroupId) ?? []).map((member) => ({
            ...member,
            eventsAttended: compensationCountMap.get(`${member.competitorId}|other(${group.name})`) ?? 0,
          })),
    })),
  });

  return NextResponse.json(payload, { status: 200 });
}
