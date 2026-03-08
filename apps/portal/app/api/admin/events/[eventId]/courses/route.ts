import { randomUUID } from "node:crypto";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { courses, events } from "@/lib/db/schema";
import { toMoneyDb } from "@/lib/money";
import { requireAdminSession } from "@/lib/session";

type CourseInput = {
  courseId?: unknown;
  name?: unknown;
  lengthKm?: unknown;
  coursePoints?: unknown;
};

type UpdateCoursesBody = {
  courses?: unknown;
};

function parseOptionalDecimal(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "invalid";
  }
  return value;
}

function parseOptionalInt(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return "invalid";
  }
  return value;
}

export async function GET(_: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { eventId } = await context.params;

  const rows = await withTransaction(async (tx) => {
    const exists = await tx
      .select({ eventId: events.eventId })
      .from(events)
      .where(eq(events.eventId, eventId))
      .limit(1);

    if (!exists[0]) {
      return null;
    }

    const eventCourses = await tx
      .select({
        courseId: courses.courseId,
        name: courses.name,
        lengthKm: courses.lengthKm,
        coursePoints: courses.coursePoints,
      })
      .from(courses)
      .where(eq(courses.eventId, eventId))
      .orderBy(asc(courses.name), asc(courses.courseId));

    return eventCourses.map((row: any) => ({
      courseId: row.courseId as string,
      name: row.name as string,
      lengthKm: row.lengthKm === null ? null : Number(row.lengthKm),
      coursePoints: row.coursePoints as number | null,
    }));
  });

  if (rows === null) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ courses: rows }, { status: 200 });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { eventId } = await context.params;
  const body = (await request.json()) as UpdateCoursesBody;

  if (!Array.isArray(body.courses)) {
    return NextResponse.json({ error: "courses must be an array" }, { status: 400 });
  }

  const normalized = [] as Array<{
    courseId: string;
    name: string;
    lengthKm: number | null;
    coursePoints: number | null;
  }>;
  const seenIds = new Set<string>();

  for (const item of body.courses as CourseInput[]) {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "course name is required" }, { status: 400 });
    }

    const lengthKm = parseOptionalDecimal(item.lengthKm);
    if (lengthKm === "invalid") {
      return NextResponse.json({ error: "lengthKm must be a non-negative decimal number" }, { status: 400 });
    }

    const coursePoints = parseOptionalInt(item.coursePoints);
    if (coursePoints === "invalid") {
      return NextResponse.json({ error: "coursePoints must be a non-negative integer" }, { status: 400 });
    }

    const incomingId = typeof item.courseId === "string" ? item.courseId.trim() : "";
    const courseId = incomingId || randomUUID();
    if (seenIds.has(courseId)) {
      return NextResponse.json({ error: "duplicate courseId in request" }, { status: 400 });
    }
    seenIds.add(courseId);

    normalized.push({ courseId, name, lengthKm, coursePoints });
  }

  const saved = await withTransaction(async (tx) => {
    const exists = await tx
      .select({ eventId: events.eventId })
      .from(events)
      .where(eq(events.eventId, eventId))
      .limit(1);

    if (!exists[0]) {
      return null;
    }

    if (normalized.length === 0) {
      await tx.delete(courses).where(eq(courses.eventId, eventId));
    } else {
      for (const item of normalized) {
        await tx
          .insert(courses)
          .values({
            eventId,
            courseId: item.courseId,
            classId: "manual",
            name: item.name,
            priceCents: toMoneyDb(0),
            lengthKm: item.lengthKm === null ? null : String(item.lengthKm),
            coursePoints: item.coursePoints,
          })
          .onConflictDoUpdate({
            target: [courses.eventId, courses.courseId],
            set: {
              name: item.name,
              lengthKm: item.lengthKm === null ? null : String(item.lengthKm),
              coursePoints: item.coursePoints,
            },
          });
      }

      await tx
        .delete(courses)
        .where(
          and(
            eq(courses.eventId, eventId),
            notInArray(
              courses.courseId,
              normalized.map((item) => item.courseId),
            ),
          ),
        );
    }

    const eventCourses = await tx
      .select({
        courseId: courses.courseId,
        name: courses.name,
        lengthKm: courses.lengthKm,
        coursePoints: courses.coursePoints,
      })
      .from(courses)
      .where(eq(courses.eventId, eventId))
      .orderBy(asc(courses.name), asc(courses.courseId));

    return eventCourses.map((row: any) => ({
      courseId: row.courseId as string,
      name: row.name as string,
      lengthKm: row.lengthKm === null ? null : Number(row.lengthKm),
      coursePoints: row.coursePoints as number | null,
    }));
  });

  if (saved === null) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, courses: saved }, { status: 200 });
}
