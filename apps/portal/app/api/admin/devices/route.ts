import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

export async function GET() {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provisionLogs = await db
    .select({ payload: auditLog.payload })
    .from(auditLog)
    .where(and(eq(auditLog.action, "device_provisioned"), eq(auditLog.actorId, adminId)))
    .orderBy(desc(auditLog.createdAt));

  const deviceNames = Array.from(
    new Set(provisionLogs.map((item) => extractDeviceName(item.payload)).filter((value): value is string => Boolean(value))),
  );
  if (deviceNames.length === 0) {
    return NextResponse.json({ devices: [] }, { status: 200 });
  }

  const rows = await db
    .select({
      id: devices.id,
      assignedUserId: devices.assignedUserId,
      status: devices.status,
      heartbeatStatus: devices.heartbeatStatus,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .where(inArray(devices.id, deviceNames))
    .orderBy(asc(devices.id));

  return NextResponse.json({ devices: rows }, { status: 200 });
}
