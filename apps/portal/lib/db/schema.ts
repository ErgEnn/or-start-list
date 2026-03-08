import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  eventId: text("event_id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventSnapshotVersions = pgTable(
  "event_snapshot_versions",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.version] })],
);

export const adminUsers = pgTable("admin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  status: text("status").notNull(),
  assignedUserId: text("assigned_user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "restrict" }),
  heartbeatStatus: text("heartbeat_status").notNull().default("offline"),
  heartbeatMeta: jsonb("heartbeat_meta").notNull().default({}),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const competitors = pgTable(
  "competitors",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    competitorId: text("competitor_id").notNull(),
    eolNumber: text("eol_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dob: date("dob"),
    club: text("club"),
    siCard: text("si_card"),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.competitorId] }),
    index("competitors_event_last_name_idx").on(table.eventId, table.lastName, table.firstName),
    index("competitors_event_eol_number_idx").on(table.eventId, table.eolNumber),
  ],
);

export const classes = pgTable(
  "classes",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.classId] })],
);

export const courses = pgTable(
  "courses",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    classId: text("class_id").notNull(),
    name: text("name").notNull(),
    priceCents: numeric("price_cents", { precision: 10, scale: 2 }).notNull(),
    lengthKm: numeric("length_km", { precision: 8, scale: 3 }),
    coursePoints: integer("course_points"),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.courseId] })],
);

export const quickFilters = pgTable(
  "quick_filters",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    filterId: text("filter_id").notNull(),
    name: text("name").notNull(),
    queryDefinition: text("query_definition").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.filterId] })],
);

export const pricingRules = pgTable(
  "pricing_rules",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "cascade" }),
    pricingRuleId: text("pricing_rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.pricingRuleId] })],
);

export const registrations = pgTable(
  "registrations",
  {
    registrationId: uuid("registration_id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "restrict" }),
    competitorId: text("competitor_id").notNull(),
    courseId: text("course_id").notNull(),
    priceCents: numeric("price_cents", { precision: 10, scale: 2 }).notNull(),
    createdAtDevice: timestamp("created_at_device", { withTimezone: true }).notNull(),
    localSeq: integer("local_seq").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("registrations_device_local_seq_idx").on(table.deviceId, table.localSeq)],
);

export const publishedRegistrations = pgTable(
  "published_registrations",
  {
    publishId: uuid("publish_id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId, { onDelete: "restrict" }),
    rowNo: integer("row_no").notNull(),
    eolCode: text("eol_code").notNull(),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
    comment: text("comment"),
    courseId: text("course_id").notNull(),
    compGroupId: text("comp_group_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("published_registrations_device_event_row_uidx").on(table.deviceId, table.eventId, table.rowNo)],
);

export const auditLog = pgTable("audit_log", {
  auditId: bigserial("audit_id", { mode: "number" }).primaryKey(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceCompetitors = pgTable(
  "source_competitors",
  {
    competitorId: text("competitor_id").primaryKey(),
    eolNumber: text("eol_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dob: date("dob"),
    club: text("club"),
    siCard: text("si_card"),
    payloadHash: text("payload_hash").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("source_competitors_last_name_idx").on(table.lastName, table.firstName),
    uniqueIndex("source_competitors_eol_number_uidx").on(table.eolNumber),
  ],
);

export const reservedCodes = pgTable(
  "reserved_codes",
  {
    code: text("code").primaryKey(),
    isReserved: boolean("is_reserved").notNull().default(true),
    competitorId: text("competitor_id"),
    eolNumber: text("eol_number"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    dob: date("dob"),
    club: text("club"),
    siCard: text("si_card"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reserved_codes_is_reserved_idx").on(table.isReserved),
    index("reserved_codes_last_name_idx").on(table.lastName, table.firstName),
    index("reserved_codes_eol_number_idx").on(table.eolNumber),
  ],
);

export const rentalSis = pgTable(
  "rental_sis",
  {
    code: text("code").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rental_sis_code_idx").on(table.code)],
);

export const paymentGroups = pgTable(
  "payment_groups",
  {
    paymentGroupId: text("payment_group_id").primaryKey(),
    name: text("name").notNull(),
    globalPriceOverrideCents: numeric("global_price_override_cents", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_groups_name_idx").on(table.name)],
);

export const paymentGroupCompetitors = pgTable(
  "payment_group_competitors",
  {
    paymentGroupId: text("payment_group_id")
      .notNull()
      .references(() => paymentGroups.paymentGroupId, { onDelete: "cascade" }),
    competitorId: text("competitor_id").notNull(),
    priceOverrideCents: numeric("price_override_cents", { precision: 10, scale: 2 }),
  },
  (table) => [
    primaryKey({ columns: [table.paymentGroupId, table.competitorId] }),
    index("payment_group_competitors_competitor_idx").on(table.competitorId),
  ],
);

export const competitionGroups = pgTable(
  "competition_groups",
  {
    name: text("name").primaryKey(),
    gender: text("gender"),
    minYear: integer("min_year"),
    maxYear: integer("max_year"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("competition_groups_name_idx").on(table.name)],
);
