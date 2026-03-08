import { defineConfig } from "drizzle-kit";

const connectionString = "postgresql://or_user:or_password@localhost:5432/or_start_list";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
