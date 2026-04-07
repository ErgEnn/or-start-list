import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { mapPreferences, sourceCompetitors } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type CsvRow = {
  eolNumber: string;
  courseName: string;
  waterproofMap: boolean;
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

    const courseName = parts[1]?.trim() ?? "";
    if (!courseName) return null;

    if (seen.has(eolNumber)) continue;
    seen.add(eolNumber);

    let waterproofMap = false;
    if (parts[2] !== undefined) {
      const raw = parts[2].trim().toLowerCase();
      waterproofMap = raw === "1" || raw === "true";
    }

    rows.push({ eolNumber, courseName, waterproofMap });
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

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

    await tx.delete(mapPreferences);

    for (const row of csvRows) {
      const competitorId = eolToCompetitorId.get(row.eolNumber)!;
      await tx.insert(mapPreferences).values({
        competitorId,
        courseName: row.courseName,
        waterproofMap: row.waterproofMap,
      });
    }

    return { ok: true, imported: csvRows.length };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, notFound: result.notFound }, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
