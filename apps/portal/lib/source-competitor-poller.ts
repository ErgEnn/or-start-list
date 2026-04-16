import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { importSourceCompetitorsCsv } from "@/lib/source-competitor-csv";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DEVICE_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

type PollerState = {
  started: boolean;
  timer: ReturnType<typeof setInterval> | null;
};

function getPollerState(): PollerState {
  const g = globalThis as typeof globalThis & {
    __sourceCompetitorCsvPoller?: PollerState;
  };
  if (!g.__sourceCompetitorCsvPoller) {
    g.__sourceCompetitorCsvPoller = { started: false, timer: null };
  }
  return g.__sourceCompetitorCsvPoller;
}

async function hasActiveDevice(): Promise<boolean> {
  const threshold = new Date(Date.now() - DEVICE_ACTIVE_THRESHOLD_MS);
  const rows = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.status, "active"), gt(devices.lastSeenAt, threshold)))
    .limit(1);
  return rows.length > 0;
}

async function pollOnce(): Promise<void> {
  try {
    const active = await hasActiveDevice();
    if (!active) {
      return;
    }

    const result = await importSourceCompetitorsCsv("scheduled");
    console.log(
      `CSV poller: imported ${result.importedCount} rows, ${result.changedCount} changed, version ${result.latestRowVersion}`,
    );
  } catch (error) {
    console.error("CSV poller: import failed:", error);
  }
}

export function startSourceCompetitorCsvPoller(): void {
  const state = getPollerState();
  if (state.started) {
    return;
  }

  state.started = true;
  state.timer = setInterval(pollOnce, POLL_INTERVAL_MS);
  console.log(`CSV source competitor poller started (interval: ${POLL_INTERVAL_MS / 1000}s)`);
}
