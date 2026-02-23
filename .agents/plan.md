# ReleaseLayer — Build Plan

## Context

Release communication infrastructure for SaaS companies. Fresh repo — delete existing Turborepo scaffold, rebuild with Cloudflare Workers + Hono + D1 + TanStack Router.

---

## Stack

- **Runtime**: Cloudflare Workers (single worker, multi-tenant)
- **API**: Hono
- **Database**: D1 via Drizzle ORM
- **Storage**: R2
- **AI**: Workers AI (`@cf/meta/llama-3.1-8b-instruct`)
- **Auth**: Better Auth (D1 adapter)
- **Frontend**: TanStack Router (file-based, loaders) + TanStack Query
- **UI**: `packages/ui` — full shadcn/ui component library
- **SDK**: Shadow DOM widget, plain DOM, IIFE bundle
- **Custom Domains**: Cloudflare Custom Hostnames
- **Package Manager**: bun
- **Build**: Turborepo

---

## Project Structure

```
releaselayer/
├── package.json              # bun workspace root
├── turbo.json
├── wrangler.jsonc
├── drizzle.config.ts
├── .dev.vars
├── .gitignore
│
├── apps/
│   ├── worker/               # @releaselayer/worker
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts      # Hono entry, host-based routing
│   │       ├── env.d.ts      # Env bindings type
│   │       │
│   │       ├── db/
│   │       │   ├── schema.ts
│   │       │   └── client.ts
│   │       │
│   │       ├── auth/
│   │       │   └── index.ts  # Better Auth instance (D1 adapter, GitHub+Google providers)
│   │       │
│   │       ├── routes/
│   │       │   ├── auth.ts
│   │       │   ├── projects.ts
│   │       │   ├── releases.ts
│   │       │   ├── sdk-config.ts
│   │       │   ├── checklist.ts
│   │       │   ├── analytics.ts
│   │       │   ├── billing.ts
│   │       │   ├── ai.ts
│   │       │   ├── integrations.ts
│   │       │   ├── webhooks.ts
│   │       │   └── domains.ts
│   │       │
│   │       ├── sdk-api/
│   │       │   ├── init.ts
│   │       │   ├── track.ts
│   │       │   └── middleware.ts
│   │       │
│   │       ├── seo/
│   │       │   ├── renderer.ts
│   │       │   └── sitemap.ts
│   │       │
│   │       ├── metering/
│   │       │   ├── counter.ts
│   │       │   └── limits.ts
│   │       │
│   │       ├── ai/
│   │       │   └── rewrite.ts
│   │       │
│   │       ├── domains/
│   │       │   └── custom-hostname.ts
│   │       │
│   │       └── lib/
│   │           ├── errors.ts
│   │           ├── pagination.ts
│   │           └── slug.ts
│   │
│   └── dashboard/            # @releaselayer/dashboard
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── router.tsx
│           ├── routeTree.gen.ts
│           ├── styles.css
│           │
│           ├── lib/
│           │   ├── api.ts
│           │   ├── auth-client.ts   # Better Auth client
│           │   └── query-client.ts
│           │
│           ├── features/
│           │   ├── auth/
│           │   │   ├── components/
│           │   │   │   ├── login-form.tsx
│           │   │   │   ├── register-form.tsx
│           │   │   │   └── oauth-buttons.tsx
│           │   │   └── lib/
│           │   │       └── auth.ts  # useSession, auth helpers
│           │   │
│           │   ├── projects/
│           │   │   ├── components/
│           │   │   │   ├── project-card.tsx
│           │   │   │   ├── project-list.tsx
│           │   │   │   └── create-project-dialog.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts   # project API functions
│           │   │       └── queries.ts  # queryOptions factories
│           │   │
│           │   ├── releases/
│           │   │   ├── components/
│           │   │   │   ├── release-list.tsx
│           │   │   │   ├── release-editor.tsx
│           │   │   │   ├── release-toolbar.tsx
│           │   │   │   ├── display-type-picker.tsx
│           │   │   │   ├── targeting-fields.tsx
│           │   │   │   └── ai-rewrite-panel.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   ├── checklists/
│           │   │   ├── components/
│           │   │   │   ├── checklist-editor.tsx
│           │   │   │   └── checklist-item.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   ├── sdk-config/
│           │   │   ├── components/
│           │   │   │   ├── theme-editor.tsx
│           │   │   │   ├── install-snippet.tsx
│           │   │   │   └── sdk-preview.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   ├── analytics/
│           │   │   ├── components/
│           │   │   │   ├── usage-meter.tsx
│           │   │   │   ├── mau-chart.tsx
│           │   │   │   └── impression-chart.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   ├── integrations/
│           │   │   ├── components/
│           │   │   │   ├── github-connect.tsx
│           │   │   │   ├── gitlab-connect.tsx
│           │   │   │   └── slack-connect.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   ├── domains/
│           │   │   ├── components/
│           │   │   │   ├── domain-setup.tsx
│           │   │   │   └── ssl-status.tsx
│           │   │   └── lib/
│           │   │       ├── api.ts
│           │   │       └── queries.ts
│           │   │
│           │   └── billing/
│           │       ├── components/
│           │       │   ├── plan-card.tsx
│           │       │   └── usage-overview.tsx
│           │       └── lib/
│           │           ├── api.ts
│           │           └── queries.ts
│           │
│           ├── components/
│           │   └── layout/
│           │       ├── app-shell.tsx
│           │       ├── sidebar.tsx
│           │       └── header.tsx
│           │
│           └── routes/
│               ├── __root.tsx
│               ├── index.tsx
│               ├── login.tsx
│               ├── register.tsx
│               ├── projects/
│               │   ├── index.tsx              # loader: fetchProjects
│               │   └── $projectId/
│               │       ├── index.tsx          # loader: fetchProject + releases
│               │       ├── releases/
│               │       │   ├── new.tsx
│               │       │   └── $releaseId.tsx # loader: fetchRelease
│               │       ├── checklist.tsx      # loader: fetchChecklists
│               │       ├── sdk.tsx            # loader: fetchSdkConfig
│               │       ├── analytics.tsx      # loader: fetchAnalytics
│               │       ├── integrations.tsx   # loader: fetchIntegrations
│               │       ├── domain.tsx         # loader: fetchDomainStatus
│               │       └── settings.tsx       # loader: fetchProject
│               ├── billing.tsx               # loader: fetchBilling
│               └── settings.tsx
│
├── packages/
│   ├── ui/                   # @releaselayer/ui — full shadcn component library
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── hover-card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── lib/
│   │   │       └── utils.ts  # cn() helper
│   │   └── tailwind.config.ts
│   │
│   ├── shared/               # @releaselayer/shared
│   │   └── src/
│   │       ├── types.ts
│   │       ├── plans.ts
│   │       ├── sdk-types.ts
│   │       └── validation.ts
│   │
│   └── sdk/                  # @releaselayer/sdk
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── index.ts
│           ├── api.ts
│           ├── shadow.ts
│           ├── state.ts
│           ├── storage.ts
│           ├── targeting.ts
│           ├── scheduling.ts
│           ├── styles.ts
│           └── widgets/
│               ├── modal.ts
│               ├── banner.ts
│               ├── changelog.ts
│               └── checklist.ts
│
└── scripts/
    └── seed.ts
```

---

## Auth: Better Auth

Using [Better Auth](https://www.better-auth.com/) with D1 adapter:

**Server** (`apps/worker/src/auth/index.ts`):
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: { clientId, clientSecret },
    google: { clientId, clientSecret },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});
```

**Client** (`apps/dashboard/src/lib/auth-client.ts`):
```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ baseURL: "/api/auth" });
export const { useSession, signIn, signUp, signOut } = authClient;
```

Better Auth handles: session management, password hashing, OAuth flows, CSRF, rate limiting, email verification. It generates its own tables (user, session, account) — these replace the manual users/sessions/oauth_accounts tables in the schema.

---

## D1 Schema (application tables only — Better Auth manages auth tables)

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE org_members (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sdk_key TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  custom_domain_status TEXT DEFAULT 'none',
  cf_hostname_id TEXT,
  branding_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (org_id, slug)
);

CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT,
  content_md TEXT NOT NULL,
  content_html TEXT,
  ai_rewrite_md TEXT,
  ai_rewrite_html TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  display_type TEXT NOT NULL DEFAULT 'modal',
  publish_at INTEGER,
  published_at INTEGER,
  unpublish_at INTEGER,
  show_once INTEGER NOT NULL DEFAULT 1,
  target_traits TEXT,
  metadata TEXT,
  source TEXT DEFAULT 'manual',
  source_ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (project_id, slug)
);

CREATE TABLE sdk_configs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  theme TEXT DEFAULT '{}',
  position TEXT DEFAULT 'bottom-right',
  z_index INTEGER DEFAULT 99999,
  custom_css TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  target_traits TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  track_event TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE impressions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT,
  end_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_impressions_project ON impressions(project_id, created_at);

CREATE TABLE mau_daily (
  project_id TEXT NOT NULL,
  day TEXT NOT NULL,
  end_user_id TEXT NOT NULL,
  PRIMARY KEY (project_id, day, end_user_id)
);

CREATE TABLE usage_monthly (
  project_id TEXT NOT NULL,
  month TEXT NOT NULL,
  mau_count INTEGER NOT NULL DEFAULT 0,
  impression_count INTEGER NOT NULL DEFAULT 0,
  ai_rewrite_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, month)
);

CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE ai_rewrites (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  input_md TEXT NOT NULL,
  output_md TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

## Host-Based Routing

- `app.releaselayer.app` → Dashboard SPA + API
- `*.releaselayer.app` → Public SEO pages + SDK API
- Custom domains → Lookup by domain in DB, same as subdomain
- All hosts serve `/sdk/*` and `/api/webhooks/*`

---

## API Routes

### Dashboard API (Better Auth session required)
| Method | Path | Purpose |
|--------|------|---------|
| ALL | `/api/auth/**` | Better Auth handler |
| GET/POST/PUT/DELETE | `/api/projects[/:pid]` | Project CRUD |
| GET/POST/PUT/DELETE | `/api/projects/:pid/releases[/:rid]` | Release CRUD |
| POST | `/api/projects/:pid/releases/:rid/publish` | Publish |
| POST | `/api/projects/:pid/releases/:rid/rewrite` | AI rewrite |
| GET/PUT | `/api/projects/:pid/sdk-config` | Widget config |
| CRUD | `/api/projects/:pid/checklists[/:cid][/items]` | Checklists |
| GET | `/api/projects/:pid/analytics` | Usage stats |
| GET/POST | `/api/billing[/checkout,/portal,/webhook]` | Stripe billing |
| CRUD | `/api/projects/:pid/integrations` | Integrations |
| PUT/DELETE/GET | `/api/projects/:pid/domain[/status]` | Custom domain |

### SDK API (SDK key, public)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sdk/init?key=&uid=&traits=` | Config + releases |
| POST | `/sdk/track` | Events + impressions |

### Webhooks (signature-verified)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/webhooks/github` | GitHub releases |
| POST | `/api/webhooks/gitlab` | GitLab events |
| POST | `/api/webhooks/custom/:key` | Custom ingest |

### SEO (server-rendered, public)
| Path | Purpose |
|------|---------|
| `/:orgSlug` | Release listing |
| `/:orgSlug/:releaseSlug` | Release detail |
| `/:orgSlug/sitemap.xml` | Sitemap |

---

## TanStack Router Pattern

Every route uses loaders for data fetching with TanStack Query integration:

```typescript
// routes/projects/$projectId/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { projectQueryOptions, releasesQueryOptions } from '@/features/projects/lib/queries'

export const Route = createFileRoute('/projects/$projectId/')({
  loader: ({ context: { queryClient }, params: { projectId } }) =>
    Promise.all([
      queryClient.ensureQueryData(projectQueryOptions(projectId)),
      queryClient.ensureQueryData(releasesQueryOptions(projectId)),
    ]),
  component: ProjectPage,
})
```

Each feature's `lib/queries.ts` exports `queryOptions` factories:

```typescript
// features/projects/lib/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchProjects, fetchProject } from './api'

export const projectsQueryOptions = () =>
  queryOptions({ queryKey: ['projects'], queryFn: fetchProjects })

export const projectQueryOptions = (id: string) =>
  queryOptions({ queryKey: ['projects', id], queryFn: () => fetchProject(id) })
```

---

## SDK Architecture

Single IIFE (~15-25KB gzipped), no framework, Shadow DOM isolation.

```html
<script src="https://cdn.releaselayer.app/sdk.js" defer></script>
<script>
  ReleaseLayer.init('rl_pk_abc123', {
    user: { id: 'user_42', traits: { plan: 'pro' } }
  });
</script>
```

`init()` → fetch `/sdk/init` → client-side trait/schedule/show-once filtering → Shadow DOM → render widgets → batch-track impressions (flush every 5s + sendBeacon on unload).

ETag caching: SDK stores response in localStorage, sends `If-None-Match`, server returns 304 if unchanged.

---

## Build Pipeline

```
bun run build
  ├── packages/shared     → tsc
  ├── packages/ui         → tsc
  ├── packages/sdk        → vite build (IIFE → sdk.js)
  ├── apps/dashboard      → vite build (SPA → dist/)
  └── apps/worker         → wrangler (dashboard dist + sdk.js → public/)
```

Dev: dashboard Vite (`:5173`, proxies to worker), worker wrangler (`:8787`), SDK vite watch.

Deploy: `bun run build && wrangler deploy`

---

## Implementation Order

### Sprint 1: Foundation
1. Delete existing scaffold, create monorepo structure
2. Set up `packages/shared` with types + validation (zod)
3. Set up `packages/ui` with all shadcn components + tailwind
4. Set up `apps/worker` with Hono, D1 bindings, Drizzle schema
5. Set up `apps/dashboard` with Vite, TanStack Router, TanStack Query, Tailwind
6. Better Auth: server instance + client, mount on `/api/auth/**`
7. Generate + run D1 migration
8. Dashboard: login/register pages, protected route layout
9. Verify full dev flow works (dashboard → proxy → worker → D1)

### Sprint 2: Core CRUD
10. Project CRUD API + dashboard (list, create, overview)
11. Release CRUD API + dashboard (list, editor with markdown, display type, targeting, scheduling)
12. SDK config API + dashboard (theme, install snippet)

### Sprint 3: SDK Widget
13. `/sdk/init` endpoint (key validation, releases, traits, CORS)
14. SDK core: init(), Shadow DOM, localStorage, ETag caching
15. SDK widgets: modal, banner, changelog feed
16. `/sdk/track` endpoint + SDK event batching + show-once logic

### Sprint 4: Metering + Analytics
17. MAU counting (mau_daily upsert on SDK init)
18. Impression counting on track events
19. Plan limit enforcement (graceful degradation)
20. Analytics dashboard page (usage charts)

### Sprint 5: Hosting + SEO
21. Host-based routing in worker entry
22. Server-rendered release listing + detail pages
23. OG tags, canonical URLs, sitemap.xml
24. Onboarding checklist: API + dashboard editor + SDK widget

### Sprint 6: Integrations + AI
25. GitHub webhook (signature verify, auto-draft from release)
26. GitLab + custom webhook endpoints
27. AI rewrite (Workers AI, structured prompt, metered)
28. Slack notification on publish

### Sprint 7: Custom Domains
29. Domain setup UI + CNAME instructions
30. Cloudflare Custom Hostname API integration
31. SSL polling (cron trigger)
32. Canonical/noindex logic

### Sprint 8: Billing + Polish
33. Stripe: products, checkout, webhook, plan upgrades
34. Billing dashboard page
35. Rate limiting on SDK endpoints
36. Branding logic (free = "Powered by ReleaseLayer")

### Sprint 9: SEO Expansion
37. Tag pages from release metadata
38. AI SEO summaries (optional toggle)
39. Internal linking between releases and tag pages
