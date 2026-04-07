"use client";

import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dropCompetitorsDb,
  getAllCompetitors,
  replaceCompetitors,
  type CompetitorRow,
} from "@/lib/competitors-indexed-db";

const COMPETITOR_VERSION_KEY = "or.portal.competitors.version";
const SEARCH_KEYS: Array<keyof CompetitorRow> = ["eolNumber", "firstName", "lastName", "siCard"];

type CompetitorChangePayload = {
  latestRowVersion: number;
  nextSinceRowVersion: number;
  nextAfterCompetitorId: string;
  hasMore: boolean;
  changes: Array<{
    rowVersion: number;
    changeType: "upsert";
    competitor: {
      competitorId: string;
      eolNumber: string;
      firstName: string;
      lastName: string;
      gender?: "male" | "female" | null;
      dob?: string;
      club?: string;
      siCard?: string;
    };
  }>;
};

function readCachedVersion() {
  const raw = window.localStorage.getItem(COMPETITOR_VERSION_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function writeCachedVersion(version: number) {
  window.localStorage.setItem(COMPETITOR_VERSION_KEY, String(Math.max(0, version)));
}

function normalizeRow(row: CompetitorChangePayload["changes"][number]["competitor"]): CompetitorRow {
  return {
    competitorId: row.competitorId,
    eolNumber: row.eolNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender ?? null,
    dob: row.dob ?? null,
    club: row.club ?? null,
    siCard: row.siCard ?? null,
  };
}

async function fetchChanges(sinceRowVersion: number, afterCompetitorId = ""): Promise<CompetitorChangePayload> {
  const response = await fetch(
    `/api/admin/competitors/changes?sinceRowVersion=${sinceRowVersion}&afterCompetitorId=${encodeURIComponent(afterCompetitorId)}`,
    {
    cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load competitor changes (${response.status})`);
  }
  return (await response.json()) as CompetitorChangePayload;
}

async function fetchAllFromVersionZero() {
  let since = 0;
  let afterCompetitorId = "";
  let latestRowVersion = 0;
  const rowsById = new Map<string, CompetitorRow>();

  while (true) {
    const payload = await fetchChanges(since, afterCompetitorId);
    latestRowVersion = payload.latestRowVersion;

    for (const change of payload.changes) {
      rowsById.set(change.competitor.competitorId, normalizeRow(change.competitor));
    }

    since = payload.nextSinceRowVersion;
    afterCompetitorId = payload.nextAfterCompetitorId;
    if (!payload.hasMore) {
      break;
    }
  }

  return {
    latestRowVersion,
    competitors: [...rowsById.values()],
  };
}

async function fetchLegacyAllRows(): Promise<CompetitorRow[]> {
  const response = await fetch("/api/admin/competitors", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load competitors (${response.status})`);
  }
  const payload = (await response.json()) as { competitors: CompetitorRow[] };
  return payload.competitors;
}

function buildAllTermsExpression(query: string) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))];
  if (terms.length === 0) {
    return null;
  }

  return {
    $and: terms.map((term) => ({
      $or: SEARCH_KEYS.map((key) => ({ [key]: `^${term}` })),
    })),
  };
}

const FUSE_OPTIONS = {
  threshold: 0.33,
  includeScore: true,
  ignoreLocation: true,
  useExtendedSearch: true,
  keys: SEARCH_KEYS,
} as const;

type UseCompetitorSearchOptions = {
  excludedCompetitorIds?: string[];
};

export function useCompetitorSearch(options?: UseCompetitorSearchOptions) {
  const excludedCompetitorIds = options?.excludedCompetitorIds ?? [];
  const [allRows, setAllRows] = useState<CompetitorRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cachedVersion, setCachedVersion] = useState<number>(0);
  const [serverVersion, setServerVersion] = useState<number | null>(null);

  const renewFromServer = useCallback(
    async (cachedRowsCount = 0) => {
      const localVersion = readCachedVersion();
      setCachedVersion(localVersion);
      const probe = await fetchChanges(localVersion);
      setServerVersion(probe.latestRowVersion);

      if (probe.latestRowVersion <= localVersion) {
        if (probe.latestRowVersion === 0 && cachedRowsCount === 0) {
          const legacyRows = await fetchLegacyAllRows();
          await replaceCompetitors(legacyRows);
          setAllRows(legacyRows);
          writeCachedVersion(0);
          setCachedVersion(0);
        }
        return;
      }

      await dropCompetitorsDb();
      const fullSnapshot = await fetchAllFromVersionZero();
      if (fullSnapshot.latestRowVersion === 0) {
        const legacyRows = await fetchLegacyAllRows();
        await replaceCompetitors(legacyRows);
        writeCachedVersion(0);
        setCachedVersion(0);
        setAllRows(legacyRows);
        return;
      }
      await replaceCompetitors(fullSnapshot.competitors);
      writeCachedVersion(fullSnapshot.latestRowVersion);
      setCachedVersion(fullSnapshot.latestRowVersion);
      setAllRows(fullSnapshot.competitors);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await dropCompetitorsDb();
      const fullSnapshot = await fetchAllFromVersionZero();
      if (fullSnapshot.latestRowVersion === 0) {
        const legacyRows = await fetchLegacyAllRows();
        await replaceCompetitors(legacyRows);
        writeCachedVersion(0);
        setCachedVersion(0);
        setAllRows(legacyRows);
        return;
      }
      await replaceCompetitors(fullSnapshot.competitors);
      writeCachedVersion(fullSnapshot.latestRowVersion);
      setCachedVersion(fullSnapshot.latestRowVersion);
      setAllRows(fullSnapshot.competitors);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const localRows = await getAllCompetitors();
      if (!cancelled) {
        setAllRows(localRows);
        setLoading(false);
      }

      try {
        await renewFromServer(localRows.length);
      } catch {
        // Keep locally cached results when sync fails.
      }
    }

    load();

    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        await renewFromServer();
      } catch {
        // Silently ignore polling failures.
      }
    }, 600_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [renewFromServer]);

  const fuseRef = useRef<{ rows: CompetitorRow[]; fuse: Fuse<CompetitorRow> } | null>(null);

  const filteredRows = useMemo(() => {
    const excluded = new Set(excludedCompetitorIds);

    if (!fuseRef.current || fuseRef.current.rows !== allRows) {
      fuseRef.current = { rows: allRows, fuse: new Fuse(allRows, FUSE_OPTIONS) };
    }

    const expression = searchQuery.trim().length >= 2 ? buildAllTermsExpression(searchQuery) : null;
    const rows = expression
      ? fuseRef.current.fuse.search(expression, { limit: 200 }).map((result) => result.item)
      : allRows;

    return excluded.size > 0 ? rows.filter((row) => !excluded.has(row.competitorId)) : rows;
  }, [allRows, excludedCompetitorIds, searchQuery]);

  return {
    allRows,
    filteredRows,
    searchInput,
    setSearchInput,
    loading,
    refresh,
    cachedVersion,
    serverVersion,
  };
}
