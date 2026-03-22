import { NextResponse } from "next/server";
import { getLatestSourceCompetitorImportStatus, importSourceCompetitors } from "@/lib/source-competitors";
import { requireAdminSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const status = await getLatestSourceCompetitorImportStatus();
  return NextResponse.json(status, { status: 200 });
}

export async function POST() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const result = await importSourceCompetitors("manual");

  return NextResponse.json(
    {
      ok: true,
      imported: result,
      status: {
        importedAt: result.importedAt,
        trigger: result.trigger,
      },
    },
    { status: 200 },
  );
}
