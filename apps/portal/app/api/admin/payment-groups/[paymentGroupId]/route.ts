import { asc, countDistinct, eq, sql } from "drizzle-orm";
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

type UpdatePaymentGroupBody = {
  name?: unknown;
  colorHex?: unknown;
  globalPriceOverride?: unknown;
  autoFromRegistrations?: unknown;
  sortOrder?: unknown;
  competitors?: unknown;
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

export async function GET(_: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId } = await context.params;

  const result = await withTransaction(async (tx) => {
    const groups = await tx
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverride: paymentGroups.globalPriceOverride,
        autoFromRegistrations: paymentGroups.autoFromRegistrations,
        sortOrder: paymentGroups.sortOrder,
      })
      .from(paymentGroups)
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
      .limit(1);

    if (!groups[0]) {
      return null;
    }

    const group = groups[0];

    if (group.autoFromRegistrations) {
      // Membership is dynamic: everyone who has ever registered. Return the count only.
      const counted = await tx
        .select({ count: countDistinct(registrations.competitorId).mapWith(Number) })
        .from(registrations);
      return {
        paymentGroupId: group.paymentGroupId,
        name: group.name,
        colorHex: group.colorHex,
        globalPriceOverride: null,
        autoFromRegistrations: true,
        sortOrder: group.sortOrder,
        competitorsCount: counted[0]?.count ?? 0,
        competitors: [],
      };
    }

    const competitors = await tx
      .select({
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
      .where(eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId))
      .orderBy(asc(sourceCompetitors.lastName), asc(sourceCompetitors.firstName), asc(paymentGroupCompetitors.competitorId)) as Array<{
        competitorId: string;
        priceOverrideCents: string | null;
        compensatedEvents: number | null;
        eolNumber: string | null;
        firstName: string | null;
        lastName: string | null;
        club: string | null;
      }>;

    const competitorIds = competitors.map((c) => c.competitorId);

    // "Compensated events used" = distinct events this competitor registered for while this
    // payment group paid for them. The desktop records that as payment_method = `other(<group name>)`.
    const compensationTag = `other(${group.name})`;
    const eventCounts =
      competitorIds.length > 0
        ? await tx
            .select({
              competitorId: registrations.competitorId,
              eventCount: countDistinct(registrations.eventId).mapWith(Number),
            })
            .from(registrations)
            .where(sql`${registrations.competitorId} IN ${competitorIds} AND ${registrations.paymentMethod} = ${compensationTag}`)
            .groupBy(registrations.competitorId)
        : [];

    const eventCountMap = new Map<string, number>();
    for (const row of eventCounts) {
      eventCountMap.set(row.competitorId, row.eventCount);
    }

    return {
      paymentGroupId: group.paymentGroupId,
      name: group.name,
      colorHex: group.colorHex,
      globalPriceOverride: moneyFromDb(group.globalPriceOverride),
      autoFromRegistrations: false,
      sortOrder: group.sortOrder,
      competitorsCount: competitors.length,
      competitors: competitors.map((c) => ({
        competitorId: c.competitorId,
        priceOverrideCents: moneyFromDb(c.priceOverrideCents),
        compensatedEvents: c.compensatedEvents,
        eolNumber: c.eolNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        club: c.club,
        eventsAttended: eventCountMap.get(c.competitorId) ?? 0,
      })),
    };
  });

  if (!result) {
    return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
  }

  return NextResponse.json({ paymentGroup: result }, { status: 200 });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId } = await context.params;
  const body = (await request.json()) as UpdatePaymentGroupBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const colorHex = normalizeColorHex(body.colorHex);
  const autoFromRegistrations = body.autoFromRegistrations === true;
  // Auto groups carry no price overrides and no manual members.
  const globalPriceOverride = autoFromRegistrations ? null : parseOptionalMoney(body.globalPriceOverride);
  const sortOrder = typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder) ? body.sortOrder : 0;
  const hasCompetitors = !autoFromRegistrations && body.competitors !== undefined;
  const competitors = hasCompetitors ? normalizeCompetitors(body.competitors) : [];

  if (!name || colorHex === "invalid" || globalPriceOverride === "invalid" || (hasCompetitors && competitors === null)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await withTransaction(async (tx) => {
    const existing = await tx
      .select({ paymentGroupId: paymentGroups.paymentGroupId })
      .from(paymentGroups)
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
      .limit(1);

    if (!existing[0]) {
      return false;
    }

    await tx
      .update(paymentGroups)
      .set({
        name,
        colorHex,
        globalPriceOverride: globalPriceOverride === null ? null : toMoneyDb(globalPriceOverride),
        autoFromRegistrations,
        sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId));

    if (autoFromRegistrations) {
      // Switching a group to auto-mode drops any previously stored manual members.
      await tx.delete(paymentGroupCompetitors).where(eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId));
    } else if (hasCompetitors && competitors) {
      await tx.delete(paymentGroupCompetitors).where(eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId));

      for (const member of competitors) {
        await tx.insert(paymentGroupCompetitors).values({
          paymentGroupId,
          competitorId: member.competitorId,
          priceOverrideCents: member.priceOverrideCents === null ? null : toMoneyDb(member.priceOverrideCents),
          compensatedEvents: member.compensatedEvents,
        });
      }
    }

    return true;
  });

  if (!updated) {
    return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId } = await context.params;

  const deleted = await withTransaction(async (tx) => {
    const rows = await tx
      .delete(paymentGroups)
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
      .returning({ paymentGroupId: paymentGroups.paymentGroupId });

    return rows.length > 0;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
