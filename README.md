# Clientito Monorepo

Starter workspace with:
- `apps/web`: Cloudflare Worker + React app (auth + dashboard shell + health API)
- `packages/shared`: shared validation/types
- `packages/sdk`: browser SDK package

## Prerequisites

- Bun `1.2.x`
- Node `20+`
- Cloudflare account + Wrangler (for deploy/migrations)

## Install

```bash
bun install
```

## Local Development

```bash
bun run dev
```

## Quality Commands

```bash
bun run check-types
bun run test
bun run build
```

## Database (D1 + Drizzle)

```bash
cd apps/web
bun run db:migrate:dev
```
