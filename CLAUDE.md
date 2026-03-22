# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OR Start List is an offline-first registration platform for orienteering competitions. Staff register competitors at events without internet connectivity; the system syncs bidirectionally when online.

## Monorepo Structure

- **apps/desktop** — Tauri v2 desktop client (React + Vite + Rust/SQLite backend)
- **apps/portal** — Next.js 15 management portal (PostgreSQL via Drizzle ORM, NextAuth)
- **packages/shared** — Domain models and sync protocol schemas (Zod)
- **packages/eol-import** — EOL XML parser for importing orienteering event data

Package manager: **pnpm** (workspaces defined in `pnpm-workspace.yaml`).

## Common Commands

```bash
# Start portal dev server
pnpm dev:portal

# Start desktop dev (builds shared package, starts Vite + Tauri)
pnpm dev:desktop

# Build shared package (required before desktop dev)
pnpm --filter @or/shared build

# Type-check all workspaces
pnpm typecheck

# Database (portal)
docker compose up -d                    # Start PostgreSQL
pnpm db:push:portal                     # Push Drizzle schema to DB
pnpm --filter @or/portal db:studio      # Open Drizzle Studio

# Desktop Tauri commands
pnpm --filter @or/desktop tauri:dev     # Dev with Tauri window
pnpm --filter @or/desktop tauri:build   # Production build
```

## Architecture

### Sync Model (Outbox + Snapshot/Delta)

The core design pattern is offline-first with eventual consistency:

1. **Desktop → Server (Push):** Device collects outbox items locally (registrations, clears, code claims). Sends via `POST /api/sync/push`. Server returns `ackSeqInclusive` for idempotency.
2. **Server → Device (Pull):** Device requests event snapshot via `GET /api/sync/pull?eventId=X&sinceVersion=Y`. Supports "snapshot" (full) or "delta" (incremental) modes.
3. **Competitor Deltas:** Separate row-versioned feed at `GET /api/sync/competitors?sinceRowVersion=X&limit=5000`.
4. **Device Cycle:** `POST /api/sync/device-cycle` performs atomic bidirectional sync in one request.

Sync schemas are defined in `packages/shared/src/sync.ts`. Outbox items are a discriminated union: `registration_created`, `registration_cleared`, `reserved_code_claimed`.

### Desktop App

- **UI:** React + MUI + Emotion, state via Zustand (`src/stores/syncStore.ts`), data layer via `useCompetitorDirectory` hook
- **Backend:** Rust with Diesel ORM on SQLite. Tauri commands in `src-tauri/src/commands.rs`, database ops in `src-tauri/src/database.rs`, sync loop in `src-tauri/src/sync.rs`
- **Tauri invoke bridge:** TS wrappers in `src/lib/desktop.ts` call Rust commands
- **i18n:** Estonian translations via i18next

### Portal App

- **Auth:** NextAuth v5 credentials provider, JWT sessions, admin users in PostgreSQL
- **Database:** PostgreSQL 16 via Drizzle ORM. Schema in `apps/portal/lib/db/schema.ts`
- **API routes:** `app/api/sync/` for device sync, `app/api/admin/` for management
- **Dashboard:** Ant Design UI under `app/dashboard/`

### Shared Package

- `src/domain.ts` — Core Zod schemas (competitor, event, course, class, registration, pricing)
- `src/sync.ts` — Sync protocol contracts (push/pull/heartbeat/device-cycle)
- `src/desktop.ts` — Desktop-specific types (bootstrap, query, event state)

## Environment

### Portal
- `DATABASE_URL` — PostgreSQL connection (default: `postgresql://or_user:or_password@localhost:5432/or_start_list`)
- `NEXTAUTH_SECRET` — JWT signing key

### Desktop
- Device config (portalBaseUrl, apiKey, textScale) stored in local SQLite
- SQLite database at `{app_data_dir}/or_start_list.sqlite`

## Key Conventions

- All cross-boundary types validated with Zod schemas in `@or/shared`
- Desktop window is 1080x1920 (portrait, touchscreen-optimized)
- Shared package must be built before desktop dev (`beforeDevCommand` handles this in Tauri config)
- Device authentication uses hashed API keys (SHA256)
