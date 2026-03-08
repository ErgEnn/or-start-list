import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { getSourceCompetitorChanges } from "@/lib/source-competitors";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceRowVersionRaw = request.nextUrl.searchParams.get("sinceRowVersion") ?? "0";
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "5000";

  const sinceRowVersion = Number.parseInt(sinceRowVersionRaw, 10);
  const limit = Math.min(20_000, Math.max(1, Number.parseInt(limitRaw, 10) || 5000));
  if (Number.isNaN(sinceRowVersion) || sinceRowVersion < 0) {
    return NextResponse.json({ error: "Invalid sinceRowVersion" }, { status: 400 });
  }

  const payload = await getSourceCompetitorChanges(sinceRowVersion, limit);
  return NextResponse.json(payload, { status: 200 });
}
