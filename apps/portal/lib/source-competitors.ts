import { createHash } from "node:crypto";
import { gunzipSync, inflateSync } from "node:zlib";
import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { withTransaction, db, type DbLike } from "@/lib/db";
import { auditLog, sourceCompetitors } from "@/lib/db/schema";

type UnknownMap = Record<string, unknown>;
type TextLike = string | number | boolean;
const DB_BATCH_SIZE = 1000;

type EolTextNode = { "#text"?: TextLike };
type EolPersonName = {
  Family?: TextLike | EolTextNode;
  Given?: TextLike | EolTextNode | Array<TextLike | EolTextNode>;
};
type EolPerson = {
  PersonName?: EolPersonName;
  PersonId?: TextLike | EolTextNode;
  BirthDate?: { Date?: TextLike | EolTextNode } | TextLike | EolTextNode;
  Sex?: TextLike | EolTextNode;
  Gender?: TextLike | EolTextNode;
  "@_sex"?: TextLike;
  "@_gender"?: TextLike;
};
type EolCCard = {
  CCardId?: TextLike | EolTextNode | Array<TextLike | EolTextNode>;
};
type EolCompetitor = {
  Person?: EolPerson;
  PersonId?: TextLike | EolTextNode;
  Club?: { ShortName?: TextLike | EolTextNode; Name?: TextLike | EolTextNode };
  ClubId?: TextLike | EolTextNode;
  CCard?: EolCCard | EolCCard[];
};
type EolCompetitorList = {
  Competitor?: EolCompetitor | EolCompetitor[];
};
type EolRoot = {
  CompetitorList?: EolCompetitorList;
  CompressedData?: TextLike | EolTextNode;
};

export type SourceCompetitorRow = {
  competitorId: string;
  eolNumber: string;
  firstName: string;
  lastName: string;
  gender?: "male" | "female";
  dob?: string;
  club?: string;
  siCard?: string;
};

type SourceCompetitorImportTrigger = "manual" | "scheduled";
type SourceCompetitorImportPayload = {
  importedCount: number;
  changedCount: number;
  deletedCount: number;
  latestRowVersion: number;
  trigger: SourceCompetitorImportTrigger;
};

export type SourceCompetitorImportStatus = {
  importedAt: string | null;
  trigger?: SourceCompetitorImportTrigger;
};

const DEFAULT_SOURCE_URL = "https://app.orienteerumine.ee/eteenused/xml_eolcodes.php?utf";
const SOURCE_COMPETITOR_IMPORT_ACTION = "source_competitors.import";

export const SOURCE_COMPETITOR_URL = process.env.COMPETITOR_SOURCE_URL ?? DEFAULT_SOURCE_URL;

let inFlightSourceCompetitorImport:
  | Promise<
      Awaited<ReturnType<typeof upsertSourceCompetitorImport>> & {
        importedAt: string;
        trigger: SourceCompetitorImportTrigger;
      }
    >
  | null = null;

function readText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object" && "#text" in (value as UnknownMap)) {
    const text = (value as UnknownMap)["#text"];
    if (typeof text !== "string" && typeof text !== "number" && typeof text !== "boolean") {
      return undefined;
    }
    const normalized = String(text).trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function chunked<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeDob(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  // Keep only valid YYYY-MM-DD calendar dates; discard placeholders like 1993-00-00.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return value;
}

function normalizeGender(value: string | undefined): "male" | "female" | undefined {
  if (!value) {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "m":
    case "male":
    case "man":
      return "male";
    case "f":
    case "female":
    case "woman":
      return "female";
    default:
      return undefined;
  }
}

function toSourceCompetitor(node: EolCompetitor): SourceCompetitorRow | null {
  const personOrId = node.Person ?? node.PersonId;
  const person =
    typeof personOrId === "object" && personOrId !== null
      ? (personOrId as EolPerson)
      : ({ PersonId: personOrId } as EolPerson);
  const personName = person.PersonName ?? {};

  const competitorId = readText(person.PersonId);
  const firstName = readText(Array.isArray(personName.Given) ? personName.Given[0] : personName.Given);
  const lastName = readText(personName.Family);
  if (!competitorId || !firstName || !lastName) {
    return null;
  }

  const eolNumber = competitorId;
  const gender =
    normalizeGender(readText(person.Sex)) ??
    normalizeGender(readText(person.Gender)) ??
    normalizeGender(person["@_sex"]?.toString()) ??
    normalizeGender(person["@_gender"]?.toString()) ??
    undefined;
  const rawDob =
    readText((person.BirthDate as UnknownMap | undefined)?.Date) ??
    readText(person.BirthDate) ??
    undefined;
  const dob = normalizeDob(rawDob);
  const club =
    readText((node.Club as UnknownMap | undefined)?.ShortName) ??
    readText((node.Club as UnknownMap | undefined)?.Name) ??
    readText(node.ClubId) ??
    undefined;
  const siCard = asArray(node.CCard)
    .flatMap((ccard) => asArray(ccard.CCardId))
    .map((cardId) => readText(cardId))
    .find((cardId): cardId is string => Boolean(cardId));

  return {
    competitorId,
    eolNumber,
    firstName,
    lastName,
    gender,
    dob,
    club,
    siCard,
  };
}

function hashCompetitor(row: SourceCompetitorRow): string {
  return createHash("sha256")
    .update(
      [
        row.competitorId,
        row.eolNumber,
        row.firstName,
        row.lastName,
        row.gender ?? "",
        row.dob ?? "",
        row.club ?? "",
        row.siCard ?? "",
      ].join("|"),
    )
    .digest("hex");
}

function maybeGunzip(bytes: Buffer, headers: Headers) {
  const contentType = headers.get("content-type") ?? "";
  const contentEncoding = headers.get("content-encoding") ?? "";
  const hasGzipHeader = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (hasGzipHeader || contentType.includes("gzip") || contentEncoding.includes("gzip")) {
    try {
      return gunzipSync(bytes);
    } catch {
      // Some runtimes already decompress response bodies before exposing bytes.
      return bytes;
    }
  }
  return bytes;
}

export async function downloadSourceCompetitorXml() {
  const response = await fetch(SOURCE_COMPETITOR_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download source competitors XML: ${response.status}`);
  }

  const compressed = Buffer.from(await response.arrayBuffer());
  const xmlBytes = maybeGunzip(compressed, response.headers);
  return xmlBytes.toString("utf8");
}

export function parseSourceCompetitorsXml(xml: string): SourceCompetitorRow[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseTagValue: false,
  });

  const root = resolveCompetitorRoot(parser, xml);
  const nodes = root.CompetitorList
    ? asArray(root.CompetitorList.Competitor)
    : asArray((root as EolCompetitorList).Competitor);

  const deduped = new Map<string, SourceCompetitorRow>();
  for (const node of nodes) {
    const row = toSourceCompetitor(node);
    if (row) {
      deduped.set(row.eolNumber, row);
    }
  }

  return [...deduped.values()];
}

function resolveCompetitorRoot(parser: XMLParser, xml: string): EolRoot {
  const first = parser.parse(xml) as EolRoot;
  if (first.CompetitorList) {
    return first;
  }

  const compressed = extractCompressedData(first);
  if (!compressed) {
    return first;
  }

  const decompressedXml = decompressCompressedData(compressed);
  const second = parser.parse(decompressedXml) as EolRoot;
  return second;
}

function extractCompressedData(root: EolRoot): string | undefined {
  const node = root.CompressedData;
  if (!node) {
    return undefined;
  }

  const text = readText(node);
  if (text) {
    return text;
  }

  if (typeof node === "object" && node !== null) {
    return readText((node as UnknownMap)["#text"]);
  }

  return undefined;
}

function decompressCompressedData(base64Payload: string): string {
  const compact = base64Payload.replace(/\s+/g, "");
  const bytes = Buffer.from(compact, "base64");
  try {
    return inflateSync(bytes).toString("utf8");
  } catch {
    return gunzipSync(bytes).toString("utf8");
  }
}

export async function upsertSourceCompetitorImport(
  tx: DbLike,
  incomingRows: SourceCompetitorRow[],
): Promise<{
  importedCount: number;
  changedCount: number;
  deletedCount: number;
  latestRowVersion: number;
}> {
  const now = new Date();
  const latestByEol = new Map<string, SourceCompetitorRow>();
  for (const row of incomingRows) {
    latestByEol.set(row.eolNumber, row);
  }

  const upserts = [...latestByEol.values()].map((row) => ({
    competitorId: row.competitorId,
    eolNumber: row.eolNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender ?? null,
    dob: row.dob ?? null,
    club: row.club ?? null,
    siCard: row.siCard ?? null,
    payloadHash: hashCompetitor(row),
    version: 1,
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
            competitorId: sql`excluded.competitor_id`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            gender: sql`excluded.gender`,
            dob: sql`excluded.dob`,
            club: sql`excluded.club`,
            siCard: sql`excluded.si_card`,
            payloadHash: sql`excluded.payload_hash`,
            version: sql`${sourceCompetitors.version} + 1`,
            updatedAt: now,
          },
          setWhere: sql`${sourceCompetitors.payloadHash} <> excluded.payload_hash`,
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
    deletedCount: 0,
    latestRowVersion: latestVersionResult[0]?.latestVersion ?? 0,
  };
}

async function recordSourceCompetitorImport(
  tx: DbLike,
  payload: SourceCompetitorImportPayload,
  importedAt: Date,
) {
  await tx.insert(auditLog).values({
    actorType: payload.trigger === "scheduled" ? "system" : "admin",
    actorId: payload.trigger === "scheduled" ? "source-competitor-cron" : "source-competitor-manual-import",
    action: SOURCE_COMPETITOR_IMPORT_ACTION,
    payload,
    createdAt: importedAt,
  });
}

function readImportTrigger(value: unknown): SourceCompetitorImportTrigger | undefined {
  return value === "manual" || value === "scheduled" ? value : undefined;
}

export async function getLatestSourceCompetitorImportStatus(): Promise<SourceCompetitorImportStatus> {
  const rows = await db
    .select({
      importedAt: auditLog.createdAt,
      payload: auditLog.payload,
    })
    .from(auditLog)
    .where(eq(auditLog.action, SOURCE_COMPETITOR_IMPORT_ACTION))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  const latest = rows[0];
  if (!latest?.importedAt) {
    return { importedAt: null };
  }

  const payload = latest.payload as Record<string, unknown> | null;
  return {
    importedAt: latest.importedAt.toISOString(),
    trigger: readImportTrigger(payload?.trigger),
  };
}

export async function importSourceCompetitors(trigger: SourceCompetitorImportTrigger = "manual") {
  if (inFlightSourceCompetitorImport) {
    return inFlightSourceCompetitorImport;
  }

  const run = (async () => {
    const xml = await downloadSourceCompetitorXml();
    const rows = parseSourceCompetitorsXml(xml);
    const importedAt = new Date();

    const result = await withTransaction(async (tx) => {
      const imported = await upsertSourceCompetitorImport(tx, rows);
      await recordSourceCompetitorImport(
        tx,
        {
          ...imported,
          trigger,
        },
        importedAt,
      );
      return imported;
    });

    return {
      ...result,
      importedAt: importedAt.toISOString(),
      trigger,
    };
  })();

  inFlightSourceCompetitorImport = run.finally(() => {
    inFlightSourceCompetitorImport = null;
  });

  return inFlightSourceCompetitorImport;
}

export async function getSourceCompetitorChanges(sinceRowVersion: number, limit?: number, afterCompetitorId = "") {
  const latestVersionResult = await db
    .select({ latestVersion: sql<number>`coalesce(max(${sourceCompetitors.version}), 0)` })
    .from(sourceCompetitors);
  const latestRowVersion = latestVersionResult[0]?.latestVersion ?? 0;

  const cappedLimit = typeof limit === "number" ? Math.max(1, limit) : undefined;
  const fetchLimit = typeof cappedLimit === "number" ? cappedLimit + 1 : undefined;

  const whereClause = afterCompetitorId
    ? or(
        gt(sourceCompetitors.version, sinceRowVersion),
        and(eq(sourceCompetitors.version, sinceRowVersion), gt(sourceCompetitors.competitorId, afterCompetitorId)),
      )
    : gt(sourceCompetitors.version, sinceRowVersion);

  const baseQuery = db
    .select({
      rowVersion: sourceCompetitors.version,
      competitorId: sourceCompetitors.competitorId,
      eolNumber: sourceCompetitors.eolNumber,
      firstName: sourceCompetitors.firstName,
      lastName: sourceCompetitors.lastName,
      gender: sourceCompetitors.gender,
      dob: sourceCompetitors.dob,
      club: sourceCompetitors.club,
      siCard: sourceCompetitors.siCard,
      changedAt: sourceCompetitors.updatedAt,
    })
    .from(sourceCompetitors)
    .where(whereClause)
    .orderBy(asc(sourceCompetitors.version), asc(sourceCompetitors.competitorId));

  const rows =
    typeof fetchLimit === "number"
      ? await baseQuery.limit(fetchLimit)
      : await baseQuery;

  const pageRows = typeof cappedLimit === "number" ? rows.slice(0, cappedLimit) : rows;
  const hasMore = typeof cappedLimit === "number" ? rows.length > cappedLimit : false;

  const changes = pageRows.map((row: any) => ({
    rowVersion: row.rowVersion as number,
    competitorId: row.competitorId as string,
    changeType: "upsert" as const,
      competitor: {
        competitorId: row.competitorId as string,
        eolNumber: row.eolNumber as string,
        firstName: row.firstName as string,
        lastName: row.lastName as string,
        gender: (row.gender as "male" | "female" | null) ?? undefined,
        dob: (row.dob as string | null) ?? undefined,
        club: (row.club as string | null) ?? undefined,
        siCard: (row.siCard as string | null) ?? undefined,
    },
    changedAt: (row.changedAt as Date).toISOString(),
  }));
  const lastChange = changes[changes.length - 1];
  const nextSinceRowVersion = lastChange?.rowVersion ?? sinceRowVersion;
  const nextAfterCompetitorId = lastChange?.competitorId ?? afterCompetitorId;

  return {
    currentVersion: latestRowVersion,
    latestRowVersion,
    nextSinceRowVersion,
    nextAfterCompetitorId,
    hasMore,
    changes,
  };
}
