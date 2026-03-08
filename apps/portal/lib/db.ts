import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://or_user:or_password@localhost:5432/or_start_list";

const pool = new Pool({ connectionString });

export const db = drizzle(pool);

export type DbLike = any;

export async function withTransaction<T>(handler: (tx: DbLike) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => handler(tx));
}
