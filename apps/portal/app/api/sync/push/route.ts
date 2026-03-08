import { NextRequest, NextResponse } from "next/server";
import { pushRequestSchema, pushResponseSchema } from "@or/shared";
import { authenticateDevice, authenticateDeviceByName } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyOutboxItems } from "@/lib/sync";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const deviceName = request.headers.get("x-device-name") ?? request.headers.get("x-device-id");
  const auth = (await authenticateDevice(apiKey)) ?? (await authenticateDeviceByName(deviceName));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = pushRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  if (body.deviceId !== auth.id) {
    return NextResponse.json({ error: "Device mismatch" }, { status: 403 });
  }

  const response = await withTransaction(async (client) => {
    return applyOutboxItems(client, auth.id, body.items);
  });

  const finalPayload = pushResponseSchema.parse({
    ackSeqInclusive: response.ackSeqInclusive,
    acceptedCount: response.acceptedCount,
    rejected: response.rejected,
  });
  return NextResponse.json(finalPayload, { status: 200 });
}
