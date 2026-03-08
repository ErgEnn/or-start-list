"use client";

import { deleteDB, openDB } from "idb";

export type CompetitorRow = {
  competitorId: string;
  eolNumber: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  club: string | null;
  siCard: string | null;
};

const DB_NAME = "or-portal-admin-db";
const STORE_NAME = "competitors";

async function getDb() {
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "eolNumber" });
    },
  });
}

type PersistedCompetitorRow = CompetitorRow & {
  eventId?: string;
  rowKey?: string;
};

export async function replaceCompetitors(items: CompetitorRow[]) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await tx.store.clear();
  for (const item of items) {
    const { eventId: _eventId, rowKey: _rowKey, ...stored } = item as PersistedCompetitorRow;
    await tx.store.put(stored);
  }
  await tx.done;
}

export async function getAllCompetitors(): Promise<CompetitorRow[]> {
  const db = await getDb();
  const rows = await db.getAll(STORE_NAME);
  return rows.map(({ eventId: _eventId, rowKey: _rowKey, ...item }) => item as CompetitorRow);
}

export async function dropCompetitorsDb() {
  await deleteDB(DB_NAME);
}
