# Clientito Web App (Starter)

`apps/web` now contains a minimal full-stack starter:
- React frontend with landing, login/register, and an authenticated dashboard shell
- Hono Worker backend with auth and health endpoints
- D1 persistence for Better Auth tables

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

## API Surface

- `/api/auth/*` Better Auth endpoints
- `/api/health` health check

## Notes

- Route files live in `src/frontend/routes`.
- Worker routes live in `src/worker/routes`.
- Current migration set is a single starter auth migration in `drizzle/0000_auth.sql`.
