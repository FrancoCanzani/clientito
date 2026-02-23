# ReleaseLayer Monorepo

ReleaseLayer is a changelog and release-notes platform with:
- A Cloudflare Worker app (`apps/web`) for auth, project/release management, SDK init, and tracking.
- A browser SDK (`packages/sdk`) that renders release widgets and sends analytics events.
- Shared domain types/validation (`packages/shared`) used by both app and SDK.

## Workspace Layout

```
apps/
  web/                 # Cloudflare Worker + React dashboard
packages/
  shared/              # Shared types, plan limits, zod schemas
  sdk/                 # Browser SDK bundle (dist/sdk.js)
```

## Prerequisites

- Bun `1.2.x`
- Node `20+` (for tooling compatibility)
- Cloudflare account + Wrangler (for deploy/migrations)

## Install

```bash
bun install
```

## Local Development

```bash
# all workspaces (Turbo)
bun run dev

# app only
cd apps/web
bun run dev
```

## Quality Commands

From repo root:

```bash
bun run check-types
bun run test
bun run build
```

App-specific lint:

```bash
cd apps/web
bun run lint
```

## Database (D1 + Drizzle)

Generate migrations:

```bash
cd apps/web
bun run db:generate
```

Apply local migrations:

```bash
cd apps/web
bun run db:migrate:dev
```

## Deploy

```bash
cd apps/web
bun run deploy
```

Operational runbook: [`docs/runbooks/deploy.md`](./docs/runbooks/deploy.md)

## Current Feature Coverage

- Auth: register/login/logout/session (`/api/auth/*`)
- Projects: CRUD with plan-based project limits (`/api/projects/*`)
- Releases: CRUD + publish (`/api/releases/*`)
- SDK config: per-project widget configuration (`/api/sdk-config/*`)
- Checklists: CRUD + item CRUD (`/api/checklists/*`)
- Integrations: CRUD + enable/disable with role/plan guards (`/api/integrations/*`)
- Usage summary: today/month/lifetime metrics (`/api/usage/summary`)
- Public SDK endpoints:
  - `GET /sdk/init`
  - `POST /sdk/track`

## Environment

Local env vars are loaded from `apps/web/.dev.vars`.
At minimum, keep `SESSION_SECRET` set for local auth.

Bindings are configured in `apps/web/wrangler.json`:
- D1: `DB`
- R2: `R2`
- Workers AI: `AI`
