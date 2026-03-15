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
    schemaReadyPromise = createSchema().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function createSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      event_id text PRIMARY KEY,
      name text NOT NULL,
      start_date date,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_snapshot_versions (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      version integer NOT NULL,
      generated_at timestamptz NOT NULL,
      PRIMARY KEY (event_id, version)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id text PRIMARY KEY,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      password_salt text NOT NULL,
      display_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id text PRIMARY KEY,
      api_key_hash text NOT NULL UNIQUE,
      status text NOT NULL,
      assigned_user_id text NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
      heartbeat_status text NOT NULL DEFAULT 'offline',
      heartbeat_meta jsonb NOT NULL DEFAULT '{}',
      last_seen_at timestamptz
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitors (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      competitor_id text NOT NULL,
      eol_number text NOT NULL,
      first_name text NOT NULL,
      last_name text NOT NULL,
      dob date,
      club text,
      si_card text,
      PRIMARY KEY (event_id, competitor_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS competitors_event_last_name_idx ON competitors(event_id, last_name, first_name)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS competitors_event_eol_number_idx ON competitors(event_id, eol_number)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      class_id text NOT NULL,
      name text NOT NULL,
      short_name text NOT NULL,
      PRIMARY KEY (event_id, class_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      course_id text NOT NULL,
      class_id text NOT NULL,
      name text NOT NULL,
      price_cents numeric(10, 2) NOT NULL,
      length_km numeric(8, 3),
      course_points integer,
      PRIMARY KEY (event_id, course_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quick_filters (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      filter_id text NOT NULL,
      name text NOT NULL,
      query_definition text NOT NULL,
      PRIMARY KEY (event_id, filter_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      pricing_rule_id text NOT NULL,
      rule_name text NOT NULL,
      payload jsonb NOT NULL,
      PRIMARY KEY (event_id, pricing_rule_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      registration_id uuid PRIMARY KEY,
      device_id text NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
      competitor_id text NOT NULL,
      course_id text NOT NULL,
      competition_group_name text NOT NULL,
      price_cents numeric(10, 2) NOT NULL,
      created_at_device timestamptz NOT NULL,
      local_seq integer NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS registrations_device_local_seq_idx ON registrations(device_id, local_seq)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS published_registrations (
      publish_id uuid PRIMARY KEY,
      device_id text NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
      event_id text NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
      row_no integer NOT NULL,
      eol_code text NOT NULL,
      datetime timestamptz NOT NULL,
      paid_amount numeric(10, 2) NOT NULL,
      comment text,
      course_id text NOT NULL,
      comp_group_id text NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS published_registrations_device_event_row_uidx ON published_registrations(device_id, event_id, row_no)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_id bigserial PRIMARY KEY,
      actor_type text NOT NULL,
      actor_id text NOT NULL,
      action text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS source_competitors (
      competitor_id text PRIMARY KEY,
      eol_number text NOT NULL,
      first_name text NOT NULL,
      last_name text NOT NULL,
      gender text,
      dob date,
      club text,
      si_card text,
      payload_hash text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS source_competitors_last_name_idx ON source_competitors(last_name, first_name)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS source_competitors_eol_number_uidx ON source_competitors(eol_number)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reserved_codes (
      code text PRIMARY KEY,
      is_reserved boolean NOT NULL DEFAULT true,
      competitor_id text,
      eol_number text,
      first_name text,
      last_name text,
      dob date,
      club text,
      si_card text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS reserved_codes_is_reserved_idx ON reserved_codes(is_reserved)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS reserved_codes_last_name_idx ON reserved_codes(last_name, first_name)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS reserved_codes_eol_number_idx ON reserved_codes(eol_number)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rental_sis (
      code text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS rental_sis_code_idx ON rental_sis(code)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_groups (
      payment_group_id text PRIMARY KEY,
      name text NOT NULL,
      color_hex text,
      global_price_override_cents numeric(10, 2),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS payment_groups_name_idx ON payment_groups(name)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_group_competitors (
      payment_group_id text NOT NULL REFERENCES payment_groups(payment_group_id) ON DELETE CASCADE,
      competitor_id text NOT NULL,
      price_override_cents numeric(10, 2),
      PRIMARY KEY (payment_group_id, competitor_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS payment_group_competitors_competitor_idx ON payment_group_competitors(competitor_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competition_groups (
      name text PRIMARY KEY,
      gender text,
      min_year integer,
      max_year integer,
      price numeric(10, 2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS competition_groups_name_idx ON competition_groups(name)`);
}

export async function withTransaction<T>(handler: (tx: DbLike) => Promise<T>): Promise<T> {
  await ensurePortalSchema();
  return db.transaction(async (tx) => handler(tx));
}

