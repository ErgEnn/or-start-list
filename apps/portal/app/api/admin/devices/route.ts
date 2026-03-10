import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auditLog, devices } from "@/lib/db/schema";

function extractDeviceName(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as { deviceName?: unknown; deviceId?: unknown }).deviceName
    ?? (payload as { deviceName?: unknown; deviceId?: unknown }).deviceId;
  return typeof value === "string" && value.trim() ? value : null;
}

function extractApiKey(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as { apiKey?: unknown }).apiKey;
  return typeof value === "string" && value.trim() ? value : null;
}

function extractLastError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as { lastError?: unknown }).lastError;
  return typeof value === "string" && value.trim() ? value : null;
}

export async function GET() {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provisionLogs = await db
    .select({ payload: auditLog.payload })
    .from(auditLog)
    .where(eq(auditLog.action, "device_provisioned"))
    .orderBy(desc(auditLog.createdAt));

  const latestApiKeys = new Map<string, string | null>();
  for (const item of provisionLogs) {
    const deviceName = extractDeviceName(item.payload);
    if (!deviceName || latestApiKeys.has(deviceName)) {
      continue;
    }
    latestApiKeys.set(deviceName, extractApiKey(item.payload));
  }

  const rows = await db
    .select({
      id: devices.id,
      apiKey: devices.apiKeyHash,
      status: devices.status,
      heartbeatStatus: devices.heartbeatStatus,
      heartbeatMeta: devices.heartbeatMeta,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .where(eq(devices.assignedUserId, adminId))
    .orderBy(asc(devices.id));

  return NextResponse.json({
    devices: rows.map((row) => ({
      id: row.id,
      apiKey: latestApiKeys.get(row.id) ?? null,
      status: row.status,
      heartbeatStatus: row.heartbeatStatus,
      lastError: extractLastError(row.heartbeatMeta),
      lastSeenAt: row.lastSeenAt,
    })),
  }, { status: 200 });
}
