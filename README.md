# OR Start List

Offline-first registration platform:

- `apps/desktop`: Tauri desktop client (React + Emotion + SQLite).
- `apps/portal`: Next.js management portal (PostgreSQL).
- `packages/shared`: shared domain and sync contracts.
- `packages/eol-import`: EOL XML import parser and normalizer.

## Quick start

1. Install Node.js 20+, pnpm, Rust (for desktop).
2. Install dependencies:
   - `pnpm install`
3. Run portal:
   - `pnpm dev:portal`
4. Run desktop:
   - `pnpm dev:desktop`

## Database

Portal expects `DATABASE_URL` (PostgreSQL). Schema is defined in TypeScript:

- `apps/portal/lib/db/schema.ts`

Push schema to DB with Drizzle Kit:

- `pnpm db:push:portal`

## Portal env

Define portal secrets and connection values in one place:

- `apps/portal/.env`
- template: `apps/portal/.env.example`

Competitor datasource import + row-versioned delta sync:

- `POST /api/admin/competitors/import-source`
- `GET /api/sync/competitors?sinceRowVersion=0&limit=5000`
