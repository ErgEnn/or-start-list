PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS competitors (
  competitor_id TEXT PRIMARY KEY,
  eol_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  club TEXT,
  event_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS competitors_last_name_idx ON competitors(last_name, first_name);
CREATE INDEX IF NOT EXISTS competitors_eol_number_idx ON competitors(eol_number);
CREATE TABLE IF NOT EXISTS classes (
  class_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  course_id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quick_filters (
  filter_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_definition TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pricing_rules (
  pricing_rule_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  registration_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  competitor_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  created_at_device TEXT NOT NULL,
  local_seq INTEGER NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS outbox (
  local_seq INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  last_pulled_version INTEGER NOT NULL DEFAULT 0,
  last_pushed_seq_ack INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS device_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL
);
INSERT OR IGNORE INTO sync_state(singleton, device_id, event_id, last_pulled_version, last_pushed_seq_ack)
VALUES (1, '', '', 0, 0);