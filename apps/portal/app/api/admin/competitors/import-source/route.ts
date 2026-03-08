import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { downloadSourceCompetitorXml, parseSourceCompetitorsXml, upsertSourceCompetitorImport } from "@/lib/source-competitors";
import { requireAdminSession } from "@/lib/session";

export async function POST() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const xml = await downloadSourceCompetitorXml();
  const rows = parseSourceCompetitorsXml(xml);
  const result = await withTransaction((tx) => upsertSourceCompetitorImport(tx, rows));

  return NextResponse.json(
    {
      ok: true,
      imported: result,
    },
    { status: 200 },
  );
}
