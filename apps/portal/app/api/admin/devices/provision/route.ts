import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hashApiKey } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { auditLog, devices } from "@/lib/db/schema";

const API_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateApiKey() {
  const bytes = randomBytes(8);
  let output = "";
  for (let index = 0; index < 8; index += 1) {
    output += API_KEY_ALPHABET[bytes[index] % API_KEY_ALPHABET.length];
  }
  return output;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { deviceName?: string; deviceId?: string };
  const deviceName = (body.deviceName ?? body.deviceId ?? "").trim();
  if (!deviceName) {
    return NextResponse.json({ error: "deviceName is required" }, { status: 400 });
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  await withTransaction(async (tx) => {
    await tx
      .insert(devices)
      .values({
        id: deviceName,
        apiKeyHash,
        status: "active",
        assignedUserId: adminId,
      })
      .onConflictDoUpdate({
        target: devices.id,
        set: {
          apiKeyHash,
          status: "active",
          assignedUserId: adminId,
        },
      });

    await tx.insert(auditLog).values({
      actorType: "admin_user",
      actorId: adminId,
      action: "device_provisioned",
      payload: { deviceName, userId: adminId, adminName: session?.user?.name ?? null },
    });
  });

  return NextResponse.json({
    ok: true,
    deviceName,
    userId: adminId,
    apiKey
  });
}
