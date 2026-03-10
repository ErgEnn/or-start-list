import { createHash } from "node:crypto";
import { and, eq, type SQL } from "drizzle-orm";
import { db } from "./db";
import { devices } from "./db/schema";

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function normalizeApiKey(rawApiKey: string | null): string | null {
  if (!rawApiKey) {
    return null;
  }
  const apiKey = rawApiKey.trim();
  if (!apiKey || apiKey.length > 8) {
    return null;
  }
  return apiKey;
}

export type DeviceAuth = {
  id: string;
  assigned_user_id: string;
  status: string;
};

async function findActiveDevice(whereClause: SQL<unknown> | undefined) {
  if (!whereClause) {
    return null;
  }

  const result = await db
    .select({
      id: devices.id,
      assigned_user_id: devices.assignedUserId,
      status: devices.status,
    })
    .from(devices)
    .where(whereClause)
    .limit(1);

  return result[0] ?? null;
}

export async function authenticateDevice(rawApiKey: string | null): Promise<DeviceAuth | null> {
  const apiKey = normalizeApiKey(rawApiKey);
  if (!apiKey) {
    return null;
  }
  return findActiveDevice(and(eq(devices.apiKeyHash, hashApiKey(apiKey)), eq(devices.status, "active")));
}

export async function authenticateDeviceByName(rawDeviceName: string | null): Promise<DeviceAuth | null> {
  if (!rawDeviceName) {
    return null;
  }
  const deviceName = rawDeviceName.trim();
  if (!deviceName) {
    return null;
  }
  return findActiveDevice(and(eq(devices.id, deviceName), eq(devices.status, "active")));
}
