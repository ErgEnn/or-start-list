import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { heartbeatRequestSchema } from "@or/shared";
import { authenticateDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-device-key");
  const auth = await authenticateDevice(apiKey);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = heartbeatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  await db
    .update(devices)
    .set({
      lastSeenAt: new Date(),
      heartbeatStatus: body.status,
      heartbeatMeta: body.metadata ?? {},
    })
    .where(eq(devices.id, auth.id));

  return NextResponse.json({ ok: true }, { status: 200 });
}
