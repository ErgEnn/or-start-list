import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://or_user:or_password@localhost:5432/or_start_list";

const pool = new Pool({ connectionString });

export const db = drizzle(pool);

export type DbLike = any;

let schemaReadyPromise: Promise<void> | null = null;

export async function ensurePortalSchema(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        ALTER TABLE source_competitors
        ADD COLUMN IF NOT EXISTS gender text
      `);
      await pool.query(`
        ALTER TABLE registrations
        ADD COLUMN IF NOT EXISTS competition_group_name text
      `);
      await pool.query(`
        ALTER TABLE payment_groups
        ADD COLUMN IF NOT EXISTS global_price_override_cents numeric(10, 2)
      `);
      await pool.query(`
        ALTER TABLE payment_groups
        ADD COLUMN IF NOT EXISTS color_hex text
      `);
      await pool.query(`
        ALTER TABLE payment_group_competitors
        ADD COLUMN IF NOT EXISTS price_override_cents numeric(10, 2)
      `);
      await pool.query(`
        UPDATE registrations
        SET competition_group_name = course_id
        WHERE competition_group_name IS NULL OR competition_group_name = ''
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

export async function withTransaction<T>(handler: (tx: DbLike) => Promise<T>): Promise<T> {
  await ensurePortalSchema();
  return db.transaction(async (tx) => handler(tx));
}
