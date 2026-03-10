import { deviceSyncCycleRequestSchema, deviceSyncCycleResponseSchema } from "@or/shared";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { loadDeviceCycle } from "@/lib/device-cycle";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deviceSyncCycleRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const payload = await withTransaction((tx) => loadDeviceCycle(tx, auth.id, parsed.data));
  return NextResponse.json(deviceSyncCycleResponseSchema.parse(payload), { status: 200 });
}
