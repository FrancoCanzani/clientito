# Architecture

> Internal note: this document is being reconciled for the Duomo beta. Some sections still describe an older server-side mail-corpus design and should not be used as launch-facing product documentation.

This document is the technical reference for how Duomo works end to end. It covers the runtime model, data flow, storage layers, sync pipeline, AI classification, and frontend patterns. Written for anyone who needs to understand the system before changing it.

## Runtime Model

Duomo is a single Cloudflare Worker that serves both the API and the frontend SPA. One deployment artifact, one URL.

```
Browser (React SPA)
  ├── PGlite (IndexedDB) ← local email store
  ├── React Query        ← cache + fetching
  └── fetch /api/*       ← talks to the worker
          │
Cloudflare Worker (Hono)
  ├── D1 (SQLite)        ← authoritative data store
  ├── R2                  ← attachment blobs
  ├── Queues              ← async sync jobs
  ├── Durable Objects     ← AI agent state
  └── Gmail API           ← email provider
```

The worker handles three Cloudflare event types:

- **fetch**: HTTP requests (API routes + static SPA assets)
- **scheduled**: Cron triggers every 1 and 5 minutes
- **queue**: Async sync job processing from Cloudflare Queues

## Project Structure

```
src/
├── worker/                  # Cloudflare Worker (backend)
│   ├── index.ts             # Entry point, middleware stack, event routing
│   ├── middleware/           # Auth, rate limiting
│   ├── db/schema.ts         # D1 schema (Drizzle ORM)
│   ├── routes/
│   │   ├── inbox/emails/    # Email CRUD, list, search
│   │   ├── inbox/sync/      # Sync status and triggers
│   │   ├── inbox/filters/   # User-defined email rules
│   │   ├── inbox/subscriptions/ # Mailing list management
│   │   ├── inbox/drafts/    # Draft persistence
│   │   ├── ai/              # Grammar, rewrite endpoints
│   │   └── settings/        # User preferences
│   ├── lib/gmail/
│   │   ├── client.ts        # Gmail HTTP client, OAuth tokens
│   │   ├── driver.ts        # EmailProvider implementation
│   │   ├── mailbox/read.ts  # Message parsing, MIME extraction
│   │   ├── mailbox/send.ts  # Email composition and sending
│   │   ├── sync/engine.ts   # Core sync orchestration
│   │   ├── sync/state.ts    # Mailbox locks, job tracking
│   │   ├── sync/preferences.ts # Sync window config
│   │   ├── intelligence/    # AI classification pipeline
│   │   ├── subscriptions/   # Unsubscribe tracking
│   │   └── user-filters.ts  # Filter evaluation
│   ├── jobs/                # Background job handlers
│   ├── queue.ts             # Queue message consumer
│   ├── scheduled.ts         # Cron job dispatcher
│   └── agent/               # Durable Object AI agent
│
├── frontend/                # React SPA
│   ├── main.tsx             # App entry, providers
│   ├── router.tsx           # TanStack Router config
│   ├── routes/              # File-based routing
│   │   ├── __root.tsx       # Root layout + error boundary
│   │   ├── _dashboard/      # Authenticated shell
│   │   │   ├── route.tsx    # Auth gate, providers, preferences
│   │   │   ├── $mailboxId/  # Mailbox-scoped views
│   │   │   │   ├── inbox/   # Inbox, labels, search, email detail
│   │   │   │   └── $folder/ # Sent, spam, trash, snoozed, archived, starred
│   │   │   └── settings.tsx # Preferences page
│   │   ├── get-started.tsx  # Onboarding flow
│   │   └── login.tsx        # Auth page
│   ├── db/
│   │   ├── client.ts        # PGlite setup, all local queries
│   │   ├── schema.ts        # Local PostgreSQL schema
│   │   ├── sync.ts          # Server → local sync pipeline
│   │   └── user.ts          # Session/user helpers
│   ├── features/
│   │   ├── email/inbox/     # Core inbox feature
│   │   ├── email/filters/   # Email filter UI
│   │   ├── email/subscriptions/ # Subscription management UI
│   │   ├── onboarding/      # Mailbox connection + setup
│   │   └── settings/        # User preferences
│   ├── components/          # Shared UI (shadcn-based)
│   ├── hooks/               # Shared React hooks
│   └── lib/                 # Auth client, query client, utils
```

## Authentication

Duomo uses [better-auth](https://www.better-auth.com/) with session cookies.

- **Providers**: Google OAuth (email/password also available)
- **OAuth scopes**: Gmail read/modify/send, Calendar events (future), profile
- **Session**: Cookie-based, no client-side token storage
- **Account linking**: Multiple Google accounts per user supported
- **Route protection**: `_dashboard/route.tsx` runs `getDashboardGate()` in `beforeLoad` — redirects to `/login` or `/get-started` as needed

The auth middleware in `src/worker/middleware/auth.ts` attaches the user and session to the Hono context. Routes call `requireAuth()` to enforce authentication.

## Database: Server (D1)

The authoritative data store is Cloudflare D1 (SQLite). Schema is defined with Drizzle ORM in `src/worker/db/schema.ts`.

### Core Tables

| Table | Purpose |
|---|---|
| `emails` | Full email storage — metadata, body (HTML + text), labels, thread info |
| `emailIntelligence` | AI classification results — category, urgency, suspicious flags, summary |
| `emailSubscriptions` | Mailing list tracking — sender aggregation, unsubscribe method/status |
| `emailFilters` | User-defined rules — conditions (from/to/subject/category) + actions |
| `mailboxes` | Connected accounts — provider, OAuth state, sync cursor, lock state |
| `syncJobs` | Sync execution records — kind, status, progress, errors |
| `scheduledEmails` | Send-later queue — scheduled time, status, retry count |
| `drafts` | Composition state — recipients, subject, body, attachments |

### Key Design Decisions

- **`labelIds` is a JSON array** of Gmail label strings, stored as text. This avoids a join table and matches Gmail's native model.
- **`historyId`** on mailboxes is the Gmail History API cursor for incremental sync.
- **`lockUntil`** prevents concurrent syncs on the same mailbox.
- **`emailIntelligence` is a separate table** from `emails` because classification is async — emails exist before their AI data does.

## Database: Client (PGlite)

The frontend runs a full PostgreSQL instance in the browser via [@electric-sql/pglite](https://github.com/electric-sql/pglite), persisted to IndexedDB.

### Why a Local Database?

- **Instant queries**: Email list filtering, full-text search, and view changes hit local Postgres — no round-trip to the server.
- **Offline resilience**: Cached data survives network drops.
- **Reduced server load**: After initial sync, the server only handles mutations and incremental updates.

### Setup

Defined in `src/frontend/db/client.ts`:

- **Connection**: `idb://petit` (IndexedDB persistence)
- **Initialization**: Lazy singleton via `ensureReady()` — creates tables and indices on first access
- **Schema version**: Tracked in a `meta` table. Version bump forces a full re-sync (drops and recreates tables).
- **FTS**: `search_vector` column with GIN index for full-text search across subject, body, and sender
- **Corruption recovery**: If init fails, the IDB database is destroyed and recreated automatically
- **Storage durability**: Calls `navigator.storage.persist()` after init to prevent browser eviction

### Schema Mirroring

The local schema in `src/frontend/db/schema.ts` mirrors the server schema with PostgreSQL types:

- `serial` primary keys (instead of D1's autoincrement)
- `bigint` for timestamps
- `jsonb` for complex fields (labels, intelligence data)

The local DB does not replicate every server table — only `emails`, `emailIntelligence`, and `meta` (for sync state tracking).

### Progressive Sync

Defined in `src/frontend/db/sync.ts`:

```
fetchEmails() called
  ↓
isSynced(userId, mailboxId)?
  ├── yes → query local PGlite directly
  └── no  → fire-and-forget ensureLocalSync()
            ↓
            pullAll() — pages through /api/inbox/emails
              ↓ (each page)
              insertEmails() + insertEmailIntelligence()
              ↓
              invalidateQueries(["emails"]) ← UI refreshes
```

Sync is **non-blocking**. The route loader returns whatever is in the local DB immediately (even if empty). As each page of emails arrives from the server, it's inserted locally and the React Query cache is invalidated, so the email list populates progressively.

Key details:
- Page size: 100 emails per fetch
- Deduplication: `syncInFlight` Map prevents duplicate sync tasks
- Cache keys: `synced-mailbox:{userId}:{mailboxId}` tracks per-mailbox sync completion
- User alignment: If a different user logs in, local data is cleared and re-synced

## Email Sync: Server Side

The server sync pipeline is the most complex subsystem. It lives in `src/worker/lib/gmail/sync/`.

### Sync Types

| Type | Trigger | What It Does |
|---|---|---|
| **Full sync** | First connect, manual trigger, or recovery | Fetches all messages within the sync window (default 6 months) |
| **Incremental sync** | Cron (every 5 min) | Uses Gmail History API to fetch only changes since last `historyId` |
| **Recovery sync** | History gap detected | Triggered when Gmail reports history has expired; escalates to full sync |

### Full Sync Flow

```
Route/Queue triggers sync
  → Acquire mailbox lock (lockUntil)
  → Create syncJob record (status: running)
  → Gmail API: list message IDs within sync window
  → Batch fetch messages (50 at a time, with retry/rate-limit)
  → For each batch:
      → Parse MIME → extract metadata, body, headers
      → Upsert into D1 emails table
      → Extract unsubscribe metadata → upsert subscriptions
      → Queue intelligence records (status: pending)
  → Update mailbox historyId cursor
  → Mark syncJob succeeded
  → Release lock
```

### Incremental Sync Flow

```
Cron fires (every 5 min)
  → For each mailbox:
      → Gmail History API: changes since historyId
      → Process additions (new messages) and label changes
      → Update D1 accordingly
      → Advance historyId
  → If history expired:
      → Enqueue recovery-sync via Queue
```

### Queues

Sync jobs are processed via Cloudflare Queues (`petit-sync`):

- **Batch size**: 1 (one sync job at a time)
- **Max retries**: 3
- **Dead-letter queue**: Failed jobs go to `petit-sync-dlq`
- **Lock mechanism**: `lockUntil` on the mailbox row prevents concurrent syncs

### Error Handling

Errors are classified in `src/worker/lib/gmail/errors.ts`:

- **Reconnect-required**: OAuth token revoked, insufficient scopes → sets `authState = reconnect_required` on mailbox
- **Transient**: Rate limits, network failures → retried via queue
- **Consecutive failures**: Tracked per mailbox for escalation

## AI Classification

Every email gets an AI classification. The pipeline runs in two stages.

### Stage 1: Background Classification

Defined in `src/worker/lib/gmail/intelligence/background-intelligence.ts`.

A cron job (`*/1 * * * *`) picks up `emailIntelligence` records with `status: pending` and processes them:

1. Build a prompt from the email content and thread context
2. Include any active user filters in the prompt
3. Call OpenAI (via Vercel AI SDK) with structured output
4. Parse the response into classification fields

**Categories** (action-oriented, not noun-based):

| Category | Meaning |
|---|---|
| `to_respond` | User must reply — question asked, meeting proposed, approval requested |
| `to_follow_up` | User must act but not reply — pay a bill, sign a document, meet a deadline |
| `fyi` | Informational — no action needed, worth reading |
| `notification` | Automated — shipping updates, login alerts, confirmations |
| `invoice` | Financial — invoices, receipts, payment confirmations |
| `marketing` | Promotional — newsletters, deals, product announcements |

**Other fields**:
- `urgency`: high / medium / low
- `suspicious`: Array of flags — phishing, impersonation, credential_harvest, payment_fraud (each with a confidence level)

### Stage 2: User Filter Override

After AI classification, user-defined filters are evaluated. If a filter matches and has an `applyCategory` action, it overrides the AI category. Filters can also apply mutations (archive, mark read, star).

### Stage 3: On-Demand Detail

When a user opens an email, `fetchEmailDetailAI()` checks for a cached summary. If none exists, it fetches from `/api/inbox/emails/:id/ai` which generates a detailed summary, reply drafts, and action suggestions.

## Views and Routing

### View Types

The inbox has three kinds of views, defined in `src/frontend/features/email/inbox/utils/inbox-filters.ts`:

| Kind | Views | Route Pattern |
|---|---|---|
| **Inbox** | `inbox` | `/$mailboxId/inbox` |
| **Folders** | `sent`, `spam`, `trash`, `snoozed`, `archived`, `starred` | `/$mailboxId/$folder` |
| **Labels** | `important`, `to_respond`, `to_follow_up`, `fyi`, `notification`, `invoice`, `marketing` | `/$mailboxId/inbox/labels/$label` |

The `important` view is an aggregation: it shows emails where `category IN ('to_respond', 'to_follow_up')`.

### View Filtering

Both server-side (`src/worker/routes/inbox/emails/utils.ts`) and client-side (`src/frontend/db/client.ts`) share the same filtering logic, using a `CATEGORY_VIEWS` Set for category-based views:

```typescript
const CATEGORY_VIEWS = new Set(["to_respond", "to_follow_up", "fyi", "notification", "invoice", "marketing"]);

if (CATEGORY_VIEWS.has(view)) {
  // filter by emailIntelligence.category = view
} else if (view === "important") {
  // filter by category IN ('to_respond', 'to_follow_up')
} else {
  // filter by Gmail label or folder
}
```

### Route Loaders

Each route has a `loader` that calls `fetchEmails()` with the appropriate view. Since sync is non-blocking, loaders resolve instantly — they return whatever is in the local DB, even if it's empty during first sync.

## Frontend Patterns

### Data Fetching

All email data flows through React Query (TanStack Query):

- **Query keys**: `["emails", view, mailboxId]` for lists, `["email-detail", emailId]` for detail
- **Stale time**: 30 seconds (default), 5 minutes for AI data
- **Infinite queries**: Email lists use `useInfiniteQuery` for scroll-based pagination
- **Optimistic updates**: Mutations update the local PGlite DB first, then the server. On server response, the query cache is invalidated.

### Component Architecture

The inbox UI follows a shell pattern:

```
_dashboard (auth gate + providers)
  └── $mailboxId (account context)
      └── SidebarProvider
          ├── InboxSidebarShell (nav, labels, account switcher)
          └── Outlet
              ├── inbox/ → InboxPage → EmailList
              ├── $folder/ → FolderPage → EmailList
              ├── inbox/labels/$label/ → LabelPage → EmailList
              └── */email/$emailId → EmailDetailPage → EmailThread
```

**EmailList** uses `@tanstack/react-virtual` for virtualized scrolling (40px row height). Thread grouping collapses related messages into a single row.

**Email composition** uses TipTap as the rich text editor, with a bubble menu for formatting. Drafts are persisted to D1 with a `composeKey` for deduplication.

### Sidebar

The sidebar (`inbox-sidebar-shell.tsx`) has three sections:

1. **Navigation**: Inbox, Starred, Snoozed, Sent, Done (archived), Spam, Trash
2. **Labels** (collapsible): Important, To respond, To follow up, FYI, Notification, Invoice, Marketing — each with a colored indicator dot
3. **Account**: Account switcher (bottom)

### Command Palette

A Cmd+K command palette provides quick access to navigation, email actions, AI agent, and search.

### Keyboard Shortcuts

Full keyboard navigation: `j`/`k` for list navigation, `e` to archive, `#` to trash, `r` to reply, `c` to compose, `/` to search, `?` for help dialog.

### Preferences

User preferences stored server-side, applied in the dashboard layout:

- **Font**: Reading font selection (`data-font` attribute)
- **Warmth**: Blue-light filter — on, off, or auto (activates in evening hours)

## Scheduled Jobs

Two cron patterns run via `src/worker/scheduled.ts`:

**Every 1 minute:**
- `processPendingEmailIntelligence()` — picks up pending AI classification records, processes in batch

**Every 5 minutes:**
- `processScheduledEmails()` — sends queued send-later emails
- `cleanOrphanedAttachments()` — removes R2 blobs with no matching draft
- `syncMailboxes()` — triggers incremental sync for all connected mailboxes

## Attachments

Attachments are stored in Cloudflare R2 (`petit-attachments` bucket). Upload happens during composition via a presigned URL flow. Attachment metadata (key, filename, MIME type, size) is stored in the draft record as a JSON array.

## Error Recovery

### Sync Failures

- Transient errors retry via the queue (up to 3 attempts)
- OAuth failures set `authState = reconnect_required` on the mailbox, prompting the user to re-authorize
- History gaps trigger recovery sync (full re-fetch)
- Consecutive failures are tracked for monitoring

### Local DB Corruption

If PGlite fails to initialize (IndexedDB corruption), the client:

1. Destroys the IndexedDB database
2. Recreates PGlite from scratch
3. Re-syncs all data from the server

A "Reset local data" button in settings lets users manually trigger this.

## Configuration Files

| File | Purpose |
|---|---|
| `wrangler.json` | Worker config — D1, R2, Queues, Durable Objects, cron triggers, asset routing |
| `vite.config.ts` | Build config — TanStack Router plugin, React Compiler, Tailwind CSS 4, Cloudflare integration |
| `drizzle.worker.config.ts` | Worker DB migration config — SQLite dialect, schema sources, output directory |
| `drizzle.client.config.ts` | Client DB migration config — PostgreSQL dialect for PGlite/IndexedDB |
| `auth.ts` | better-auth config — Google OAuth, scopes, session settings |
| `tsconfig.worker.json` | Worker TypeScript config (Node.js compat) |
| `tsconfig.app.json` | Frontend TypeScript config (ES2020, DOM) |

## Key Dependencies

| Package | Role |
|---|---|
| `hono` | HTTP framework for the worker |
| `drizzle-orm` | SQL query builder for D1 |
| `better-auth` | OAuth + session management |
| `@electric-sql/pglite` | PostgreSQL in WebAssembly (browser) |
| `@tanstack/react-router` | File-based routing with loaders |
| `@tanstack/react-query` | Data fetching, caching, mutations |
| `@tanstack/react-virtual` | Virtualized list rendering |
| `@tiptap/react` | Rich text editor for composition |
| `ai` + `@ai-sdk/openai` | AI SDK for structured output (classification, summaries) |
| `motion` | Animation library (route transitions) |
| `zod` | Schema validation (API requests, AI output) |

## Provider Architecture

The codebase is structured for multi-provider support, though only Google/Gmail is implemented today:

- `src/worker/lib/gmail/types.ts` defines the `EmailProvider` interface
- `src/worker/lib/gmail/resolver.ts` resolves a mailbox to its provider (currently always returns `GmailDriver`)
- `src/worker/lib/gmail/driver.ts` implements the provider interface

Adding a new provider (e.g., Outlook) means implementing `EmailProvider` and updating the resolver. The sync engine, AI pipeline, filter system, and all frontend code are provider-agnostic — they work with the normalized `emails` table, not Gmail-specific data.
