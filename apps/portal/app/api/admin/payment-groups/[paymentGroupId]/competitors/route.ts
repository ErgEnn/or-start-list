import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups } from "@/lib/db/schema";
import { parseOptionalMoney, toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

export async function POST(request: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { paymentGroupId } = await context.params;
  const body = (await request.json()) as { competitorId?: unknown; priceOverrideCents?: unknown; compensatedEvents?: unknown };

  const competitorId = typeof body.competitorId === "string" ? body.competitorId.trim() : "";
  if (!competitorId) {
    return NextResponse.json({ error: "competitorId is required" }, { status: 400 });
  }

  const priceOverrideCents = parseOptionalMoney(body.priceOverrideCents);
  if (priceOverrideCents === "invalid") {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const compensatedEvents =
    body.compensatedEvents === null || body.compensatedEvents === undefined
      ? null
      : typeof body.compensatedEvents === "number" && Number.isInteger(body.compensatedEvents) && body.compensatedEvents >= 0
        ? body.compensatedEvents
        : ("invalid" as const);
  if (compensatedEvents === "invalid") {
    return NextResponse.json({ error: "Invalid compensatedEvents" }, { status: 400 });
  }

  const ok = await withTransaction(async (tx) => {
    const existing = await tx
      .select({ paymentGroupId: paymentGroups.paymentGroupId })
      .from(paymentGroups)
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
      .limit(1);

    if (!existing[0]) {
      return false;
    }

    const alreadyMember = await tx
      .select({ competitorId: paymentGroupCompetitors.competitorId })
      .from(paymentGroupCompetitors)
      .where(
        and(
          eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId),
          eq(paymentGroupCompetitors.competitorId, competitorId),
        ),
      )
      .limit(1);

    if (alreadyMember.length > 0) {
      return true;
    }

    await tx.insert(paymentGroupCompetitors).values({
      paymentGroupId,
      competitorId,
      priceOverrideCents: priceOverrideCents === null ? null : toMoneyDb(priceOverrideCents),
      compensatedEvents,
    });

    await tx
      .update(paymentGroups)
      .set({ updatedAt: new Date() })
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId));

    return true;
  });

  if (!ok) {
    return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
