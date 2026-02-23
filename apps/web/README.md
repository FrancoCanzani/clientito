# ReleaseLayer Web App

`apps/web` is a full-stack Cloudflare Worker app:
- React dashboard (TanStack Router + React Query)
- Hono API routes (`/api/*`)
- Public SDK API (`/sdk/*`)
- D1-backed persistence via Drizzle ORM

## Scripts

```bash
bun run dev            # local dev server
bun run build          # typecheck + production build
bun run lint           # eslint
bun run check-types    # tsc project refs
bun run deploy         # wrangler deploy

bun run db:generate    # generate Drizzle migration
bun run db:migrate:dev # apply migration to local D1
bun run db:reset:dev   # reset local D1 state and re-apply migrations
```

Local Vite + Worker development and Wrangler migrations both persist to `./.wrangler/state` so they share one local D1 state directory.

If you see `no such table: users` or `no such table: sessions` in local dev, stop the dev server, run `bun run db:reset:dev`, then start `bun run dev` again.

## API Surface

- `/api/auth` register/login/logout/me
- `/api/projects` project CRUD
- `/api/releases` release CRUD + publish
- `/api/sdk-config` widget config for projects
- `/api/checklists` checklist + checklist item CRUD
- `/api/integrations` integration CRUD + toggle
- `/api/usage/summary` usage metrics for dashboards
- `/sdk/init` public init payload for SDK consumers
- `/sdk/track` event ingestion for SDK impressions/actions

## Notes

- Route files live in `src/frontend/routes`.
- Worker routes live in `src/worker/routes`.
- Shared request validation is in `packages/shared/src/validation.ts`.
- Invalid JSON requests return `400` via `src/worker/lib/request.ts`.
