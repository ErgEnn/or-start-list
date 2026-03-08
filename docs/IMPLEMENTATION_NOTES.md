# Implementation Notes

## Monorepo

- `apps/desktop`: Tauri + React + Emotion desktop client.
- `apps/portal`: Next.js portal with sync APIs.
- `packages/shared`: shared domain + sync zod schemas.
- `packages/eol-import`: EOL XML parser and mapper.

## Portal setup

1. Define all portal secrets/env values in `apps/portal/.env`.
2. Push DB schema from TypeScript:
   - `apps/portal/lib/db/schema.ts`
   - `pnpm --filter @or/portal db:push`
3. Start app:
   - `pnpm dev:portal`

### Key APIs

- `POST /api/admin/devices/provision`: create/rotate device key
- `POST /api/admin/import/eol`: import EOL XML data
- `POST /api/admin/competitors/import-source`: download + import full competitors list from remote XML datasource
- `POST /api/sync/push`: receive desktop outbox
- `GET /api/sync/pull`: return event snapshot
- `GET /api/sync/competitors?sinceRowVersion=...`: row-versioned competitors delta feed
- `POST /api/sync/heartbeat`: mark device online/offline status

## Desktop setup

1. Ensure Rust + Tauri prerequisites installed.
2. Start web dev shell:
   - `pnpm dev:desktop`
3. Start native shell:
   - `pnpm --filter @or/desktop tauri:dev`

### Device config fields (stored in local SQLite)

- `portalBaseUrl`
- `deviceId`
- `apiKey`
- `eventId`

## Current v1 constraints

- Snapshot apply currently refreshes full local master dataset.
- Sync endpoint auth is API key only.
- Server-side rate limiting and richer admin UI are pending.
