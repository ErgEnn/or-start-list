import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stebbyConfig, stebbyPersons, stebbyTickets } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/session";

type StebbyTicketResponse = {
  pagination: { page: number; pages: number; size: number; total: number };
  tickets: Array<{
    client: { name: string };
    code: string;
    validUntil: string;
    purchasable: {
      amount: number;
      category: string;
      code: string;
      exists: boolean;
      name: string;
      price: number;
    };
  }>;
};

export async function POST() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const configRows = await db
    .select({ apiKey: stebbyConfig.apiKey })
    .from(stebbyConfig)
    .where(eq(stebbyConfig.id, "default"))
    .limit(1);

  if (configRows.length === 0) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  const apiKey = configRows[0].apiKey;

  // Fetch all tickets from Stebby, paginating through all pages
  const allTickets: StebbyTicketResponse["tickets"] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch("https://api.stebby.eu/api/v4/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        pagination: { page, limit: 100 },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Stebby API error:", response.status, text);
      return NextResponse.json(
        { error: `Stebby API returned ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as StebbyTicketResponse;
    allTickets.push(...data.tickets);
    totalPages = data.pagination.pages;
    page++;
  } while (page <= totalPages);

  // Group tickets by client name
  const personMap = new Map<string, StebbyTicketResponse["tickets"]>();
  for (const ticket of allTickets) {
    const name = ticket.client.name;
    if (!personMap.has(name)) {
      personMap.set(name, []);
    }
    personMap.get(name)!.push(ticket);
  }

  // Clear old data and insert fresh
  await db.delete(stebbyTickets);
  await db.delete(stebbyPersons);

  for (const [name, tickets] of personMap) {
    const [person] = await db
      .insert(stebbyPersons)
      .values({ name })
      .returning({ id: stebbyPersons.id });

    for (const ticket of tickets) {
      await db.insert(stebbyTickets).values({
        personId: person.id,
        ticketCode: ticket.code,
        validUntil: ticket.validUntil ? new Date(ticket.validUntil) : null,
        purchasableName: ticket.purchasable.name,
        purchasableCode: ticket.purchasable.code,
        purchasablePrice: ticket.purchasable.price != null ? String(Number(ticket.purchasable.price).toFixed(2)) : null,
        purchasableCategory: ticket.purchasable.category,
      });
    }
  }

  // Update last synced timestamp
  await db
    .update(stebbyConfig)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(stebbyConfig.id, "default"));

  return NextResponse.json({
    ok: true,
    personsCount: personMap.size,
    ticketsCount: allTickets.length,
  });
}
