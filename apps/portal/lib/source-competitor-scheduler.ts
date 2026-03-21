import { getLatestSourceCompetitorImportStatus, importSourceCompetitors } from "@/lib/source-competitors";

const SOURCE_COMPETITOR_TIME_ZONE = "Europe/Tallinn";
const SOURCE_COMPETITOR_IMPORT_HOUR = 16;

type SchedulerState = {
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function getSchedulerState() {
  const globalScheduler = globalThis as typeof globalThis & {
    __sourceCompetitorScheduler?: SchedulerState;
  };

  if (!globalScheduler.__sourceCompetitorScheduler) {
    globalScheduler.__sourceCompetitorScheduler = {
      started: false,
      timer: null,
    };
  }

  return globalScheduler.__sourceCompetitorScheduler;
}

function getDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number.parseInt(part.value, 10)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function addDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function createDateForTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(candidate, timeZone);
    candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offset);
  }

  return candidate;
}

function getTodayRunAt(now: Date) {
  const parts = getDateTimeParts(now, SOURCE_COMPETITOR_TIME_ZONE);
  return createDateForTimeZone(
    parts.year,
    parts.month,
    parts.day,
    SOURCE_COMPETITOR_IMPORT_HOUR,
    0,
    0,
    SOURCE_COMPETITOR_TIME_ZONE,
  );
}

function getNextRunAt(now: Date) {
  const parts = getDateTimeParts(now, SOURCE_COMPETITOR_TIME_ZONE);
  const shouldUseNextDay =
    parts.hour > SOURCE_COMPETITOR_IMPORT_HOUR ||
    (parts.hour === SOURCE_COMPETITOR_IMPORT_HOUR && (parts.minute > 0 || parts.second > 0));
  const nextDate = addDays(parts.year, parts.month, parts.day, shouldUseNextDay ? 1 : 0);

  return createDateForTimeZone(
    nextDate.year,
    nextDate.month,
    nextDate.day,
    SOURCE_COMPETITOR_IMPORT_HOUR,
    0,
    0,
    SOURCE_COMPETITOR_TIME_ZONE,
  );
}

async function runScheduledImport() {
  try {
    const result = await importSourceCompetitors("scheduled");
    console.log("Scheduled source competitor import finished:", result.importedAt);
  } catch (error) {
    console.error("Scheduled source competitor import failed:", error);
  }
}

async function maybeRunMissedImport(now: Date) {
  const todayRunAt = getTodayRunAt(now);
  if (todayRunAt > now) {
    return;
  }

  const latestImport = await getLatestSourceCompetitorImportStatus();
  const latestImportedAt = latestImport.importedAt ? new Date(latestImport.importedAt) : null;
  if (latestImportedAt && latestImportedAt >= todayRunAt) {
    return;
  }

  await runScheduledImport();
}

function scheduleNextRun() {
  const state = getSchedulerState();
  const now = new Date();
  const nextRunAt = getNextRunAt(now);
  const delay = Math.max(1_000, nextRunAt.getTime() - now.getTime());

  if (state.timer) {
    clearTimeout(state.timer);
  }

  state.timer = setTimeout(async () => {
    await runScheduledImport();
    scheduleNextRun();
  }, delay);

  console.log("Next source competitor import scheduled for:", nextRunAt.toISOString());
}

export async function startSourceCompetitorImportScheduler() {
  const state = getSchedulerState();
  if (state.started) {
    return;
  }

  state.started = true;

  try {
    await maybeRunMissedImport(new Date());
  } catch (error) {
    console.error("Failed to run missed source competitor import:", error);
  }

  scheduleNextRun();
}
