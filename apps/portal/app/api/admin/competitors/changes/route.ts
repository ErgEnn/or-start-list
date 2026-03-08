import { NextRequest, NextResponse } from "next/server";
import { getSourceCompetitorChanges } from "@/lib/source-competitors";
import { requireAdminSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const sinceRowVersionRaw = request.nextUrl.searchParams.get("sinceRowVersion") ?? "0";
  const sinceRowVersion = Number.parseInt(sinceRowVersionRaw, 10);

  if (Number.isNaN(sinceRowVersion) || sinceRowVersion < 0) {
    return NextResponse.json({ error: "Invalid sinceRowVersion" }, { status: 400 });
  }

  const payload = await getSourceCompetitorChanges(sinceRowVersion);
  return NextResponse.json(payload, { status: 200 });
}
