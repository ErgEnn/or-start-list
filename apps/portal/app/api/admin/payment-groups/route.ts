import { randomUUID } from "node:crypto";
import { asc, countDistinct, desc, eq, like, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups, registrations, sourceCompetitors } from "@/lib/db/schema";
import { moneyFromDb, parseOptionalMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type PaymentGroupCompetitorInput = {
  competitorId?: unknown;
  priceOverrideCents?: unknown;
  compensatedEvents?: unknown;
};

type CreatePaymentGroupBody = {
  name?: unknown;
  colorHex?: unknown;
  globalPriceOverride?: unknown;
  autoFromRegistrations?: unknown;
  sortOrder?: unknown;
  competitors?: unknown;
};

type GroupRow = {
  paymentGroupId: string;
  name: string;
  colorHex: string | null;
  globalPriceOverride: number | null;
  autoFromRegistrations: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type GroupMemberRow = {
  paymentGroupId: string;
  competitorId: string;
  priceOverrideCents: number | null;
  compensatedEvents: number | null;
  eolNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
};

type EventCountRow = {
  competitorId: string;
  paymentMethod: string;
  eventCount: number;
};

function parseOptionalNonNegativeInt(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return "invalid";
}

function normalizeCompetitors(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [] as Array<{ competitorId: string; priceOverrideCents: number | null; compensatedEvents: number | null }>;
  const seen = new Set<string>();

  for (const item of value as PaymentGroupCompetitorInput[]) {
    const competitorId = typeof item.competitorId === "string" ? item.competitorId.trim() : "";
    if (!competitorId) {
      return null;
    }

    const priceOverrideCents = parseOptionalMoney(item.priceOverrideCents);
    if (priceOverrideCents === "invalid") {
      return null;
    }

    const compensatedEvents = parseOptionalNonNegativeInt(item.compensatedEvents);
    if (compensatedEvents === "invalid") {
      return null;
    }

    if (seen.has(competitorId)) {
      return null;
    }
    seen.add(competitorId);

    normalized.push({ competitorId, priceOverrideCents, compensatedEvents });
  }

  return normalized;
}

function normalizeColorHex(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return "invalid";
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : "invalid";
}

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const groupRows = await withTransaction(async (tx) => {
    const groups = (await tx
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverride: paymentGroups.globalPriceOverride,
        autoFromRegistrations: paymentGroups.autoFromRegistrations,
        sortOrder: paymentGroups.sortOrder,
        createdAt: paymentGroups.createdAt,
        updatedAt: paymentGroups.updatedAt,
      })
      .from(paymentGroups)
      .orderBy(desc(paymentGroups.sortOrder), asc(paymentGroups.name), asc(paymentGroups.paymentGroupId))) as GroupRow[];

    // Auto groups have no rows in paymentGroupCompetitors; their member count is the distinct
    // set of competitors who have ever registered.
    const hasAutoGroup = groups.some((g) => g.autoFromRegistrations);
    const autoCompetitorCount = hasAutoGroup
      ? (await tx.select({ count: countDistinct(registrations.competitorId).mapWith(Number) }).from(registrations))[0]?.count ?? 0
      : 0;

    const competitors = (await tx
      .select({
        paymentGroupId: paymentGroupCompetitors.paymentGroupId,
        competitorId: paymentGroupCompetitors.competitorId,
        priceOverrideCents: paymentGroupCompetitors.priceOverrideCents,
        compensatedEvents: paymentGroupCompetitors.compensatedEvents,
        eolNumber: sourceCompetitors.eolNumber,
        firstName: sourceCompetitors.firstName,
        lastName: sourceCompetitors.lastName,
        club: sourceCompetitors.club,
      })
      .from(paymentGroupCompetitors)
      .leftJoin(sourceCompetitors, eq(paymentGroupCompetitors.competitorId, sourceCompetitors.competitorId))
      .orderBy(
        asc(paymentGroupCompetitors.paymentGroupId),
        asc(sourceCompetitors.lastName),
        asc(sourceCompetitors.firstName),
        asc(paymentGroupCompetitors.competitorId),
      )) as GroupMemberRow[];

    const allCompetitorIds = [...new Set(competitors.map((c) => c.competitorId))];

    // "Compensated events used" per member = distinct events the competitor registered for
    // while a payment group paid for them, recorded as payment_method = `other(<group name>)`.
    // Counted per (competitor, payment_method) so each group only sees its own usage.
    const eventCounts: EventCountRow[] =
      allCompetitorIds.length > 0
        ? await tx
            .select({
              competitorId: registrations.competitorId,
              paymentMethod: registrations.paymentMethod,
              eventCount: countDistinct(registrations.eventId).mapWith(Number),
            })
            .from(registrations)
            .where(sql`${registrations.competitorId} IN ${allCompetitorIds} AND ${like(registrations.paymentMethod, "other(%")}`)
            .groupBy(registrations.competitorId, registrations.paymentMethod)
        : [];

    const compensationCountMap = new Map<string, number>();
    for (const row of eventCounts) {
      compensationCountMap.set(`${row.competitorId}|${row.paymentMethod}`, row.eventCount);
    }

    const competitorsByGroup = new Map<string, typeof competitors>();
    for (const row of competitors) {
      const list = competitorsByGroup.get(row.paymentGroupId) ?? [];
      list.push(row);
      competitorsByGroup.set(row.paymentGroupId, list);
    }

    return groups.map((group) => {
      if (group.autoFromRegistrations) {
        // Membership is dynamic; the editable member list is not surfaced here.
        return {
          paymentGroupId: group.paymentGroupId,
          name: group.name,
          colorHex: group.colorHex,
          globalPriceOverride: null,
          autoFromRegistrations: true,
          sortOrder: group.sortOrder,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          competitorsCount: autoCompetitorCount,
          competitors: [],
        };
      }

      const members = (competitorsByGroup.get(group.paymentGroupId) ?? []).map((member) => ({
        competitorId: member.competitorId,
        priceOverrideCents: member.priceOverrideCents,
        compensatedEvents: member.compensatedEvents,
        eolNumber: member.eolNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        club: member.club,
      }));

      return {
        paymentGroupId: group.paymentGroupId,
        name: group.name,
        colorHex: group.colorHex,
        globalPriceOverride: moneyFromDb(group.globalPriceOverride),
        autoFromRegistrations: false,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        competitorsCount: members.length,
        competitors: members.map((member) => ({
          ...member,
          priceOverrideCents: moneyFromDb(member.priceOverrideCents),
          compensatedEvents: member.compensatedEvents,
          eventsAttended: compensationCountMap.get(`${member.competitorId}|other(${group.name})`) ?? 0,
        })),
      };
    });
  });

  return NextResponse.json({ paymentGroups: groupRows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as CreatePaymentGroupBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const colorHex = normalizeColorHex(body.colorHex);
  const autoFromRegistrations = body.autoFromRegistrations === true;
  // Auto groups carry no price overrides and no manual members.
  const globalPriceOverride = autoFromRegistrations ? null : parseOptionalMoney(body.globalPriceOverride);
  const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) ? body.sortOrder : 0;
  const competitors = autoFromRegistrations ? [] : normalizeCompetitors(body.competitors);

  if (!name || colorHex === "invalid" || globalPriceOverride === "invalid" || competitors === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const paymentGroupId = `pg_${randomUUID()}`;

  await withTransaction(async (tx) => {
    await tx.insert(paymentGroups).values({
      paymentGroupId,
      name,
      colorHex,
      globalPriceOverride: globalPriceOverride === null ? null : toMoneyDb(globalPriceOverride),
      autoFromRegistrations,
      sortOrder,
    });

    for (const member of competitors) {
      await tx.insert(paymentGroupCompetitors).values({
        paymentGroupId,
        competitorId: member.competitorId,
        priceOverrideCents: member.priceOverrideCents === null ? null : toMoneyDb(member.priceOverrideCents),
        compensatedEvents: member.compensatedEvents,
      });
    }
  });

  return NextResponse.json({ ok: true, paymentGroupId }, { status: 201 });
}
