import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups } from "@/lib/db/schema";
import { parseOptionalMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ paymentGroupId: string; competitorId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId, competitorId } = await context.params;
  const body = (await request.json()) as { priceOverrideCents?: unknown; compensatedEvents?: unknown };

  const priceOverrideCents = parseOptionalMoney(body.priceOverrideCents);
  if (priceOverrideCents === "invalid") {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const hasCompensatedEvents = "compensatedEvents" in body;
  const compensatedEvents = hasCompensatedEvents
    ? body.compensatedEvents === null || body.compensatedEvents === undefined
      ? null
      : typeof body.compensatedEvents === "number" && Number.isInteger(body.compensatedEvents) && body.compensatedEvents >= 0
        ? body.compensatedEvents
        : ("invalid" as const)
    : undefined;
  if (compensatedEvents === "invalid") {
    return NextResponse.json({ error: "Invalid compensatedEvents" }, { status: 400 });
  }

  const updated = await withTransaction(async (tx) => {
    const setValues: Record<string, unknown> = { priceOverrideCents: priceOverrideCents === null ? null : toMoneyDb(priceOverrideCents) };
    if (hasCompensatedEvents) {
      setValues.compensatedEvents = compensatedEvents;
    }
    const rows = await tx
      .update(paymentGroupCompetitors)
      .set(setValues)
      .where(
        and(
          eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId),
          eq(paymentGroupCompetitors.competitorId, competitorId),
        ),
      )
      .returning({ competitorId: paymentGroupCompetitors.competitorId });

    return rows.length > 0;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ paymentGroupId: string; competitorId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId, competitorId } = await context.params;

  const deleted = await withTransaction(async (tx) => {
    const rows = await tx
      .delete(paymentGroupCompetitors)
      .where(
        and(
          eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId),
          eq(paymentGroupCompetitors.competitorId, competitorId),
        ),
      )
      .returning({ competitorId: paymentGroupCompetitors.competitorId });

    if (rows.length > 0) {
      await tx
        .update(paymentGroups)
        .set({ updatedAt: new Date() })
        .where(eq(paymentGroups.paymentGroupId, paymentGroupId));
    }

    return rows.length > 0;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
