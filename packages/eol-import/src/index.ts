import { XMLParser } from "fast-xml-parser";
import type { Competitor, Course, EventClass } from "@or/shared";

export type EolImportResult = {
  event: {
    eventId: string;
    name: string;
    startDate?: string;
  };
  competitors: Competitor[];
  classes: EventClass[];
  courses: Course[];
  errors: string[];
};

type UnknownMap = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value && typeof value === "object" && "#text" in (value as UnknownMap)) {
    const text = (value as UnknownMap)["#text"];
    return typeof text === "string" ? text.trim() : undefined;
  }
  return undefined;
}

export function parseEolXml(xml: string): EolImportResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
  });
  const root = parser.parse(xml) as UnknownMap;
  const competitorList = (root.CompetitorList as UnknownMap | undefined) ?? {};
  const classData = (root.ClassData as UnknownMap | undefined) ?? {};
  const eventNode = (root.Event as UnknownMap | undefined) ?? {};
  const errors: string[] = [];

  const event = {
    eventId: readText(eventNode.EventId) ?? "event-unknown",
    name: readText(eventNode.Name) ?? "Unnamed event",
    startDate: readText((eventNode.StartDate as UnknownMap | undefined)?.Date),
  };

  const competitors: Competitor[] = asArray(
    competitorList.Competitor as UnknownMap[] | UnknownMap | undefined,
  )
    .map((raw): Competitor | undefined => {
      const person = (raw.Person as UnknownMap | undefined) ?? {};
      const personName = (person.PersonName as UnknownMap | undefined) ?? {};
      const family = readText(personName.Family);
      const given = readText(personName.Given);
      const personId = readText(person.PersonId);
      if (!family || !given || !personId) {
        errors.push("Skipped competitor with incomplete PersonName/PersonId.");
        return undefined;
      }
      return {
        competitorId: personId,
        eolNumber: personId,
        firstName: given,
        lastName: family,
        club: readText((raw.Club as UnknownMap | undefined)?.ShortName) ?? undefined,
      };
    })
    .filter((item): item is Competitor => Boolean(item));

  const classes: EventClass[] = asArray(
    classData.Class as UnknownMap[] | UnknownMap | undefined,
  )
    .map((raw): EventClass | undefined => {
      const classId = readText(raw.ClassId);
      const shortName = readText(raw.ClassShortName);
      if (!classId || !shortName) {
        errors.push("Skipped class with missing ClassId/ClassShortName.");
        return undefined;
      }
      return {
        classId,
        eventId: event.eventId,
        shortName,
        name: readText(raw.Name) ?? shortName,
      };
    })
    .filter((item): item is EventClass => Boolean(item));

  const courses: Course[] = [];

  return {
    event,
    competitors,
    classes,
    courses,
    errors,
  };
}
