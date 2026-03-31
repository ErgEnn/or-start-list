import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups, sourceCompetitors } from "@/lib/db/schema";
import { toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type CsvRow = {
  eolNumber: string;
  priceOverrideCents: number | null;
};

function parseCsv(text: string): CsvRow[] | null {
  const rows: CsvRow[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/[,;]/);
    const eolNumber = parts[0]?.trim() ?? "";
    if (!eolNumber) return null;

    if (seen.has(eolNumber)) continue;
    seen.add(eolNumber);

    let priceOverrideCents: number | null = null;
    if (parts[1] !== undefined) {
      const raw = parts[1].trim();
      if (raw !== "") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        priceOverrideCents = parsed;
      }
    }

    rows.push({ eolNumber, priceOverrideCents });
  }

  return rows;
}

export async function POST(request: NextRequest, context: { params: Promise<{ paymentGroupId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const { paymentGroupId } = await context.params;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const csvRows = parseCsv(text);
  if (!csvRows || csvRows.length === 0) {
    return NextResponse.json({ error: "Invalid CSV" }, { status: 400 });
  }

  const eolNumbers = csvRows.map((r) => r.eolNumber);

  const result = await withTransaction(async (tx) => {
    const existing = await tx
      .select({ paymentGroupId: paymentGroups.paymentGroupId })
      .from(paymentGroups)
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId))
      .limit(1);

    if (!existing[0]) return { error: "not_found" as const };

    // Resolve EOL numbers to competitor IDs
    const resolved = await tx
      .select({ competitorId: sourceCompetitors.competitorId, eolNumber: sourceCompetitors.eolNumber })
      .from(sourceCompetitors)
      .where(inArray(sourceCompetitors.eolNumber, eolNumbers));

    const eolToCompetitorId = new Map<string, string>();
    for (const row of resolved) {
      eolToCompetitorId.set(row.eolNumber, row.competitorId);
    }

    const notFound = eolNumbers.filter((eol) => !eolToCompetitorId.has(eol));
    if (notFound.length > 0) {
      return { error: "unknown_eol" as const, notFound };
    }

    // Clear existing members
    await tx.delete(paymentGroupCompetitors).where(eq(paymentGroupCompetitors.paymentGroupId, paymentGroupId));

    // Insert new members
    for (const row of csvRows) {
      const competitorId = eolToCompetitorId.get(row.eolNumber)!;
      await tx.insert(paymentGroupCompetitors).values({
        paymentGroupId,
        competitorId,
        priceOverrideCents: row.priceOverrideCents === null ? null : toMoneyDb(row.priceOverrideCents),
      });
    }

    await tx
      .update(paymentGroups)
      .set({ updatedAt: new Date() })
      .where(eq(paymentGroups.paymentGroupId, paymentGroupId));

    return { ok: true, imported: csvRows.length };
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Payment group not found" }, { status: 404 });
    }
    return NextResponse.json({ error: result.error, notFound: result.notFound }, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
