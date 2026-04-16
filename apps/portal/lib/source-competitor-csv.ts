import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { withTransaction, type DbLike } from "@/lib/db";
import { auditLog, sourceCompetitors } from "@/lib/db/schema";
import {
  chunked,
  DB_BATCH_SIZE,
  normalizeDob,
  normalizeGender,
  type SourceCompetitorRow,
  type SourceCompetitorImportTrigger,
} from "@/lib/source-competitors";

const DEFAULT_CSV_SOURCE_URL = "https://app.orienteerumine.ee/eteenused/csv_eolcodes.php";
export const SOURCE_COMPETITOR_CSV_URL = process.env.COMPETITOR_CSV_SOURCE_URL ?? DEFAULT_CSV_SOURCE_URL;
const SOURCE_COMPETITOR_CSV_IMPORT_ACTION = "source_competitors.csv_import";

let inFlightCsvImport:
  | Promise<{
      importedCount: number;
      changedCount: number;
      latestRowVersion: number;
      importedAt: string;
      trigger: SourceCompetitorImportTrigger;
    }>
  | null = null;

export async function downloadSourceCompetitorCsv(): Promise<string> {
  const response = await fetch(SOURCE_COMPETITOR_CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download source competitors CSV: ${response.status}`);
  }
  return response.text();
}

export function parseSourceCompetitorsCsv(csv: string): SourceCompetitorRow[] {
  const deduped = new Map<string, SourceCompetitorRow>();

  for (const line of csv.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = trimmed.split(";");
    if (fields.length < 6) continue;

    const eolCode = fields[0].trim();
    const lastName = fields[1].trim();
    const firstName = fields[2].trim();
    // fields[3] = club — ignored
    const rawGender = fields[4].trim();
    const rawDob = fields[5].trim();
    // fields[6] = comp_group — ignored

    if (!eolCode || !firstName || !lastName) continue;

    const gender = rawGender === "-" ? undefined : normalizeGender(rawGender);
    const dob = rawDob === "-" ? undefined : normalizeDob(rawDob);

    deduped.set(eolCode, {
      competitorId: eolCode,
      eolNumber: eolCode,
      firstName,
      lastName,
      gender,
      dob,
    });
  }

  return [...deduped.values()];
}

function hashCsvCompetitor(row: SourceCompetitorRow): string {
  return createHash("sha256")
    .update(
      [row.competitorId, row.eolNumber, row.firstName, row.lastName, row.gender ?? "", row.dob ?? ""].join("|"),
    )
    .digest("hex");
}

export async function upsertSourceCompetitorCsvImport(
  tx: DbLike,
  incomingRows: SourceCompetitorRow[],
): Promise<{
  importedCount: number;
  changedCount: number;
  latestRowVersion: number;
}> {
  const now = new Date();
  const latestByEol = new Map<string, SourceCompetitorRow>();
  for (const row of incomingRows) {
    latestByEol.set(row.eolNumber, row);
  }

  const maxVersionResult = await tx
    .select({ maxVersion: sql<number>`coalesce(max(${sourceCompetitors.version}), 0)` })
    .from(sourceCompetitors);
  const nextVersion = (maxVersionResult[0]?.maxVersion ?? 0) + 1;

  const upserts = [...latestByEol.values()].map((row) => ({
    competitorId: row.competitorId,
    eolNumber: row.eolNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender ?? null,
    dob: row.dob ?? null,
    club: null as string | null,
    siCard: null as string | null,
    payloadHash: hashCsvCompetitor(row),
    version: nextVersion,
    createdAt: now,
    updatedAt: now,
  }));

  let changedCount = 0;
  if (upserts.length > 0) {
    for (const batch of chunked(upserts, DB_BATCH_SIZE)) {
      const changedRows = await tx
        .insert(sourceCompetitors)
        .values(batch)
        .onConflictDoUpdate({
          target: sourceCompetitors.eolNumber,
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            gender: sql`excluded.gender`,
            dob: sql`excluded.dob`,
            version: nextVersion,
            updatedAt: now,
          },
          setWhere: sql`
            ${sourceCompetitors.firstName} IS DISTINCT FROM excluded.first_name
            OR ${sourceCompetitors.lastName} IS DISTINCT FROM excluded.last_name
            OR ${sourceCompetitors.gender} IS DISTINCT FROM excluded.gender
            OR ${sourceCompetitors.dob} IS DISTINCT FROM excluded.dob
          `,
        })
        .returning({ eolNumber: sourceCompetitors.eolNumber });
      changedCount += changedRows.length;
    }
  }

  const latestVersionResult = await tx
    .select({ latestVersion: sql<number>`coalesce(max(${sourceCompetitors.version}), 0)` })
    .from(sourceCompetitors);

  return {
    importedCount: upserts.length,
    changedCount,
    latestRowVersion: latestVersionResult[0]?.latestVersion ?? 0,
  };
}

async function recordCsvImport(
  tx: DbLike,
  payload: {
    importedCount: number;
    changedCount: number;
    latestRowVersion: number;
    trigger: SourceCompetitorImportTrigger;
  },
  importedAt: Date,
) {
  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: "source-competitor-csv-poller",
    action: SOURCE_COMPETITOR_CSV_IMPORT_ACTION,
    payload,
    createdAt: importedAt,
  });
}

export async function importSourceCompetitorsCsv(trigger: SourceCompetitorImportTrigger = "scheduled") {
  if (inFlightCsvImport) {
    return inFlightCsvImport;
  }

  const run = (async () => {
    const csv = await downloadSourceCompetitorCsv();
    const rows = parseSourceCompetitorsCsv(csv);
    const importedAt = new Date();

    const result = await withTransaction(async (tx) => {
      const imported = await upsertSourceCompetitorCsvImport(tx, rows);
      await recordCsvImport(tx, { ...imported, trigger }, importedAt);
      return imported;
    });

    return {
      ...result,
      importedAt: importedAt.toISOString(),
      trigger,
    };
  })();

  inFlightCsvImport = run.finally(() => {
    inFlightCsvImport = null;
  });

  return inFlightCsvImport;
}
