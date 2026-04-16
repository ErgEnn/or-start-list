import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stebbyTickets } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const { personId } = await params;
  const id = parseInt(personId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const tickets = await db
    .select({
      id: stebbyTickets.id,
      ticketCode: stebbyTickets.ticketCode,
      validUntil: stebbyTickets.validUntil,
      purchasableName: stebbyTickets.purchasableName,
      purchasableCode: stebbyTickets.purchasableCode,
      purchasablePrice: stebbyTickets.purchasablePrice,
      purchasableCategory: stebbyTickets.purchasableCategory,
    })
    .from(stebbyTickets)
    .where(eq(stebbyTickets.personId, id));

  return NextResponse.json({ tickets });
}
