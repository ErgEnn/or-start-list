import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups } from "@/lib/db/schema";
import { parseOptionalMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type PaymentGroupCompetitorInput = {
  competitorId?: unknown;
  priceOverrideCents?: unknown;
};

type UpdatePaymentGroupBody = {
  name?: unknown;
  colorHex?: unknown;
  globalPriceOverrideCents?: unknown;
  competitors?: unknown;
};

function normalizeCompetitors(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [] as Array<{ competitorId: string; priceOverrideCents: number | null }>;
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

    if (seen.has(competitorId)) {
      return null;
    }
    seen.add(competitorId);

    normalized.push({ competitorId, priceOverrideCents });
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

export async function PUT(request: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId } = await context.params;
  const body = (await request.json()) as UpdatePaymentGroupBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const colorHex = normalizeColorHex(body.colorHex);
  const globalPriceOverrideCents = parseOptionalMoney(body.globalPriceOverrideCents);
  const competitors = normalizeCompetitors(body.competitors);

  if (!name || colorHex === "invalid" || globalPriceOverrideCents === "invalid" || competitors === null) {
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
        globalPriceOverrideCents: globalPriceOverrideCents === null ? null : toMoneyDb(globalPriceOverrideCents),
        updatedAt: new Date(),
      })
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId));

    await tx.delete(paymentGroupCompetitors).where(eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId));

    for (const member of competitors) {
      await tx.insert(paymentGroupCompetitors).values({
        paymentGroupId,
        competitorId: member.competitorId,
        priceOverrideCents: member.priceOverrideCents === null ? null : toMoneyDb(member.priceOverrideCents),
      });
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
