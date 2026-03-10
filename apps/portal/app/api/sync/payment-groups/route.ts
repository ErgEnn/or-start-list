import { paymentGroupsResponseSchema } from "@or/shared";
import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentGroupCompetitors, paymentGroups } from "@/lib/db/schema";
import { moneyFromDb } from "@/lib/money";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [groupRows, memberRows] = await Promise.all([
    db
      .select({
        paymentGroupId: paymentGroups.paymentGroupId,
        name: paymentGroups.name,
        colorHex: paymentGroups.colorHex,
        globalPriceOverrideCents: paymentGroups.globalPriceOverrideCents,
      })
      .from(paymentGroups)
      .orderBy(asc(paymentGroups.name), asc(paymentGroups.paymentGroupId)),
    db
      .select({
        paymentGroupId: paymentGroupCompetitors.paymentGroupId,
        competitorId: paymentGroupCompetitors.competitorId,
        priceOverrideCents: paymentGroupCompetitors.priceOverrideCents,
      })
      .from(paymentGroupCompetitors)
      .orderBy(asc(paymentGroupCompetitors.paymentGroupId), asc(paymentGroupCompetitors.competitorId)),
  ]);

  const competitorIdsByGroup = new Map<string, string[]>();
  const competitorsByGroup = new Map<string, Array<{ competitorId: string; priceOverrideCents: number | null }>>();
  for (const row of memberRows) {
    const list = competitorIdsByGroup.get(row.paymentGroupId) ?? [];
    list.push(row.competitorId);
    competitorIdsByGroup.set(row.paymentGroupId, list);

    const members = competitorsByGroup.get(row.paymentGroupId) ?? [];
    members.push({
      competitorId: row.competitorId,
      priceOverrideCents: moneyFromDb(row.priceOverrideCents),
    });
    competitorsByGroup.set(row.paymentGroupId, members);
  }

  const payload = paymentGroupsResponseSchema.parse({
    paymentGroups: groupRows.map((group) => ({
      paymentGroupId: group.paymentGroupId,
      name: group.name,
      colorHex: group.colorHex,
      globalPriceOverrideCents: moneyFromDb(group.globalPriceOverrideCents),
      competitorIds: competitorIdsByGroup.get(group.paymentGroupId) ?? [],
      competitors: competitorsByGroup.get(group.paymentGroupId) ?? [],
    })),
  });

  return NextResponse.json(payload, { status: 200 });
}
