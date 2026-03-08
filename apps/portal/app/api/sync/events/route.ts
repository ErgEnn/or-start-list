import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice, authenticateDeviceByName } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const deviceName = request.headers.get("x-device-name") ?? request.headers.get("x-device-id");
  const auth = (await authenticateDevice(apiKey)) ?? (await authenticateDeviceByName(deviceName));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      eventId: events.eventId,
      name: events.name,
      startDate: events.startDate,
    })
    .from(events)
    .orderBy(asc(events.startDate), asc(events.name));

  return NextResponse.json({ events: rows }, { status: 200 });
}
