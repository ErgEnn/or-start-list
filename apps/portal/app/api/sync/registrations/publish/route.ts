import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { publishedRegistrations } from "@/lib/db/schema";
import { parseMoney, toMoneyDb } from "@/lib/money";

type RegistrationPublishEntry = {
  rowNo: number;
  eolCode: string;
  datetime: string;
  eventId: string;
  paidAmount: number;
  comment?: string;
  courseId: string;
  compGroupId: string;
};

function readEntries(payload: unknown): RegistrationPublishEntry[] | null {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { entries?: unknown }).entries)
      ? (payload as { entries: unknown[] }).entries
      : null;
  if (!list || list.length === 0) {
    return null;
  }

  const normalized: RegistrationPublishEntry[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const record = item as Record<string, unknown>;

    if (!Number.isInteger(record.rowNo)) {
      return null;
    }
    if (typeof record.eolCode !== "string" || record.eolCode.trim() === "") {
      return null;
    }
    if (typeof record.datetime !== "string" || record.datetime.trim() === "" || Number.isNaN(Date.parse(record.datetime))) {
      return null;
    }
    if (typeof record.eventId !== "string" || record.eventId.trim() === "") {
      return null;
    }
    const paidAmount = parseMoney(record.paidAmount);
    if (paidAmount === "invalid") {
      return null;
    }
    if (typeof record.courseId !== "string" || record.courseId.trim() === "") {
      return null;
    }
    if (typeof record.compGroupId !== "string" || record.compGroupId.trim() === "") {
      return null;
    }
    if (record.comment !== undefined && typeof record.comment !== "string") {
      return null;
    }

    normalized.push({
      rowNo: record.rowNo as number,
      eolCode: record.eolCode.trim(),
      datetime: record.datetime,
      eventId: record.eventId.trim(),
      paidAmount,
      comment: typeof record.comment === "string" ? record.comment : undefined,
      courseId: record.courseId.trim(),
      compGroupId: record.compGroupId.trim(),
    });
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = readEntries(await request.json());
  if (!entries) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const insertedRows = await withTransaction(async (tx) => {
    return tx
      .insert(publishedRegistrations)
      .values(
        entries.map((entry) => ({
          publishId: randomUUID(),
          deviceId: auth.id,
          eventId: entry.eventId,
          rowNo: entry.rowNo,
          eolCode: entry.eolCode,
          datetime: new Date(entry.datetime),
          paidAmount: toMoneyDb(entry.paidAmount),
          comment: entry.comment,
          courseId: entry.courseId,
          compGroupId: entry.compGroupId,
        })),
      )
      .onConflictDoNothing({
        target: [publishedRegistrations.deviceId, publishedRegistrations.eventId, publishedRegistrations.rowNo],
      })
      .returning({ publishId: publishedRegistrations.publishId });
  });

  return NextResponse.json(
    {
      ok: true,
      receivedCount: entries.length,
      insertedCount: insertedRows.length,
      skippedCount: entries.length - insertedRows.length,
    },
    { status: 200 },
  );
}
