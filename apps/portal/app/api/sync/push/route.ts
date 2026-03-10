import { NextRequest, NextResponse } from "next/server";
import { pushRequestSchema, pushResponseSchema } from "@or/shared";
import { authenticateDevice } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { applyOutboxItems } from "@/lib/sync";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = pushRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const response = await withTransaction(async (client) => {
    return applyOutboxItems(client, auth.id, parsed.data.items);
  });

  const finalPayload = pushResponseSchema.parse({
    ackSeqInclusive: response.ackSeqInclusive,
    acceptedCount: response.acceptedCount,
    rejected: response.rejected,
  });
  return NextResponse.json(finalPayload, { status: 200 });
}
