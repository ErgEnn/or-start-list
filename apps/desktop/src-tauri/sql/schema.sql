PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT
);

CREATE TABLE IF NOT EXISTS payment_groups (
  payment_group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex TEXT,
  global_price_override INTEGER
);

CREATE TABLE IF NOT EXISTS payment_group_members (
  payment_group_id TEXT NOT NULL,
  competitor_id TEXT NOT NULL,
  price_override_cents INTEGER,
  compensated_events INTEGER,
  events_attended INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (payment_group_id, competitor_id)
);
CREATE INDEX IF NOT EXISTS payment_group_members_competitor_idx
  ON payment_group_members(competitor_id);

CREATE TABLE IF NOT EXISTS competition_groups (
  name TEXT PRIMARY KEY,
  gender TEXT,
  min_year INTEGER,
  max_year INTEGER,
  price_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS source_competitors (
  competitor_id TEXT PRIMARY KEY,
  eol_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  club TEXT,
  si_card TEXT
);
CREATE INDEX IF NOT EXISTS source_competitors_last_name_idx
  ON source_competitors(last_name, first_name, eol_number);
CREATE INDEX IF NOT EXISTS source_competitors_eol_number_idx
  ON source_competitors(eol_number);

CREATE TABLE IF NOT EXISTS classes (
  event_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  PRIMARY KEY (event_id, class_id)
);

CREATE TABLE IF NOT EXISTS courses (
  event_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  PRIMARY KEY (event_id, course_id)
);

CREATE TABLE IF NOT EXISTS quick_filters (
  event_id TEXT NOT NULL,
  filter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_definition TEXT NOT NULL,
  PRIMARY KEY (event_id, filter_id)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  event_id TEXT NOT NULL,
  pricing_rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (event_id, pricing_rule_id)
);

CREATE TABLE IF NOT EXISTS registrations (
  registration_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  competitor_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  competition_group_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  paid_price_cents INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  created_at_device TEXT NOT NULL,
  local_seq INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_device_local_seq_idx
  ON registrations(device_id, local_seq);
CREATE INDEX IF NOT EXISTS registrations_event_competitor_seq_idx
  ON registrations(event_id, competitor_id, local_seq DESC);
CREATE INDEX IF NOT EXISTS registrations_event_seq_idx
  ON registrations(event_id, local_seq DESC);

CREATE TABLE IF NOT EXISTS outbox (
  local_seq INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_status_seq_idx ON outbox(status, local_seq);

CREATE TABLE IF NOT EXISTS event_versions (
  event_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  last_competitor_version INTEGER NOT NULL DEFAULT 0,
  last_successful_sync_at TEXT,
  last_sync_error TEXT,
  last_sync_error_detail TEXT,
  worker_status TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS device_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reserved_codes (
  code TEXT PRIMARY KEY,
  is_reserved INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS competition_group_selections (
  event_id TEXT NOT NULL,
  competitor_id TEXT NOT NULL,
  competition_group_name TEXT NOT NULL,
  PRIMARY KEY (event_id, competitor_id)
);
CREATE INDEX IF NOT EXISTS competition_group_selections_event_idx
  ON competition_group_selections(event_id);

CREATE TABLE IF NOT EXISTS map_preferences (
  competitor_id TEXT PRIMARY KEY,
  course_name TEXT NOT NULL,
  waterproof_map INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sync_meta(singleton, last_competitor_version, last_successful_sync_at, last_sync_error, worker_status)
VALUES (1, 0, NULL, NULL, 'idle');
