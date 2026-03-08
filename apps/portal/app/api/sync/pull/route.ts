import { NextRequest, NextResponse } from "next/server";
import { pullResponseSchema } from "@or/shared";
import { authenticateDevice, authenticateDeviceByName } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { loadEventDataset } from "@/lib/sync";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const deviceName = request.headers.get("x-device-name") ?? request.headers.get("x-device-id");
  const auth = (await authenticateDevice(apiKey)) ?? (await authenticateDeviceByName(deviceName));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");
  const sinceVersionRaw = request.nextUrl.searchParams.get("sinceVersion") ?? "0";
  const sinceVersion = Number.parseInt(sinceVersionRaw, 10);

  if (!eventId || Number.isNaN(sinceVersion)) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  const payload = await withTransaction((client) => loadEventDataset(client, eventId, sinceVersion));
  return NextResponse.json(pullResponseSchema.parse(payload), { status: 200 });
}
