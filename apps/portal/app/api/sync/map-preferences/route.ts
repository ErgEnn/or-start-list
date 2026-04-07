import { mapPreferencesResponseSchema } from "@or/shared";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPreferences } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      competitorId: mapPreferences.competitorId,
      courseName: mapPreferences.courseName,
      waterproofMap: mapPreferences.waterproofMap,
    })
    .from(mapPreferences);

  const payload = mapPreferencesResponseSchema.parse({ mapPreferences: rows });
  return NextResponse.json(payload, { status: 200 });
}
