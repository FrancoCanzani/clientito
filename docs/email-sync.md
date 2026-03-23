# Email Sync Architecture

This document explains how email sync currently works in Petit, with a focus on the Google/Gmail implementation that is live today.

It is written for a new backend developer who needs to:

- understand the main sync flow end to end
- know where each responsibility lives
- debug issues without reading the entire worker codebase first
- understand what is provider-neutral vs Google-specific

## High-Level Mental Model

There are three layers involved in sync:

1. Route layer
   Handles HTTP requests and decides when to trigger sync.

2. Provider-neutral email layer
   Defines the common provider interface and shared mailbox/job state.

3. Google provider implementation
   Talks to Gmail, parses messages, updates D1, applies AI labels and user filters, and keeps mailbox history state in sync.

The current production sync implementation is Google-only, but the code is now structured so the app-level entrypoints depend on `lib/email`, while the concrete sync engine lives under `lib/email/providers/google`.

## Current File Structure

### Provider-neutral email layer

- `src/worker/lib/email/types.ts`
  Defines `EmailProvider`, shared send/fetch types, and standard Gmail-compatible labels used by the app.

- `src/worker/lib/email/resolver.ts`
  Chooses the provider implementation for a mailbox.
  Today it only returns `GmailDriver`.

- `src/worker/lib/email/sync.ts`
  Provider-neutral entrypoint for "sync all mailboxes for this user".

- `src/worker/lib/email/mailbox-state.ts`
  Owns mailbox resolution, sync locks, sync job state, last error state, and mailbox sync preferences.

- `src/worker/lib/email/sync-preferences.ts`
  Sync window helpers like 6/12 month cutoff logic.

- `src/worker/lib/email/ai-classifier.ts`
  AI labeling and filter matching.

- `src/worker/lib/email/user-filters.ts`
  Loads enabled user-defined email filters.

- `src/worker/lib/email/subscriptions.ts`
  Tracks unsubscribe metadata and subscription state.

### Google provider implementation

- `src/worker/lib/email/providers/google/driver.ts`
  Concrete `EmailProvider` implementation used by routes.

- `src/worker/lib/email/providers/google/client.ts`
  Low-level Gmail HTTP client, token resolution, retry/rate-limit handling, batch fetch support.

- `src/worker/lib/email/providers/google/mailbox.ts`
  Gmail message parsing, attachment extraction/fetching, outgoing MIME composition, Gmail label mutation.

- `src/worker/lib/email/providers/google/sync.ts`
  The actual sync engine.
  This is the most important file for understanding sync behavior.

- `src/worker/lib/email/providers/google/errors.ts`
  Error classification, including reconnect-required vs transient failures.

- `src/worker/lib/email/providers/google/sync-preferences.ts`
  Google-specific query generation from the generic cutoff timestamp.

### Sync routes

- `src/worker/routes/inbox/sync/get.ts`
  Sync status endpoint and background catch-up trigger.

- `src/worker/routes/inbox/sync/post.ts`
  Full sync, incremental sync, and recovery endpoints.

- `src/worker/routes/inbox/sync/schemas.ts`
  Request schemas for sync endpoints.

### Related email routes that interact with sync

- `src/worker/routes/inbox/emails/get.ts`
  Can do a live provider fetch for a single email (`refreshLive=true`).

- `src/worker/routes/inbox/emails/post.ts`
  Sends email and then projects the sent message back into D1 via targeted message sync.

- `src/worker/routes/inbox/emails/patch.ts`
- `src/worker/routes/inbox/emails/patch-batch.ts`
  Mutate labels/state in D1 and provider.

## Data Model

These tables are the core of sync behavior.

### `emails`

Defined in `src/worker/db/schema.ts`.

Important fields:

- `providerMessageId`
  Provider-native message id.
  For Gmail this is the Gmail message id.

- `mailboxId`
  Which connected mailbox this email belongs to.

- `threadId`
  Provider thread id.

- `messageId`
  RFC `Message-ID` header if present.

- `fromAddr`, `fromName`, `toAddr`, `ccAddr`
  Parsed participants used by UI and features.

- `subject`, `snippet`, `bodyText`, `bodyHtml`
  Rendered content snapshot stored in D1.

- `labelIds`
  JSON array of provider label ids.
  For Gmail, this includes labels like `INBOX`, `UNREAD`, `SENT`, and the local convention `HAS_ATTACHMENT`.

- `aiLabel`
  App-level AI categorization.

- `unsubscribeUrl`, `unsubscribeEmail`
  Extracted from `List-Unsubscribe`.

- `snoozedUntil`
  App-level inbox behavior, not a Gmail concern.

### `mailboxes`

Represents one connected mailbox/account.

Important fields:

- `provider`
  Currently `"google"` or future `"outlook"`.

- `accountId`
  Links to auth provider account.

- `email`
  Mailbox email address.

- `historyId`
  Gmail history cursor for incremental sync.

- `syncWindowMonths`, `syncCutoffAt`
  Full/incremental sync cutoff policy.

- `authState`
  `"unknown"`, `"ok"`, or `"reconnect_required"`.

- `lastSuccessfulSyncAt`, `lastErrorAt`, `lastErrorMessage`
  Sync health state.

- `lockUntil`
  Lease-based sync lock.

### `syncJobs`

Tracks each full or incremental sync execution.

Important fields:

- `kind`
  `"full"` or `"incremental"`

- `trigger`
  `"manual"`, `"scheduled"`, or `"system"`

- `status`
  `"running"`, `"succeeded"`, or `"failed"`

- `phase`, `progressCurrent`, `progressTotal`
  Used for progress reporting in the UI.

- `errorClass`, `errorMessage`
  Used to classify failures and drive reconnect/recovery behavior.

### `emailFilters`

Stores enabled user-defined filters that can be applied during sync.

### `emailSubscriptions`

Tracks newsletter/subscription senders and unsubscribe metadata discovered during sync.

## Provider Boundary

Routes should think in terms of `EmailProvider`, not Gmail-specific helpers.

The provider interface in `src/worker/lib/email/types.ts` supports:

- fetch message bodies/attachments
- send messages
- modify labels
- sync all messages for a user
- sync a specific set of message ids
- classify reconnect-required errors

Provider selection happens in `src/worker/lib/email/resolver.ts`:

- look up mailbox by `mailboxId`
- read `mailboxes.provider`
- instantiate the provider driver

Today:

- `"google"` -> `GmailDriver`

This means the route layer is already mostly isolated from the Google implementation, even though the sync engine itself is still Google-specific.

## Route-Level Sync Lifecycle

### `GET /api/inbox/sync/status`

Handled in `src/worker/routes/inbox/sync/get.ts`.

Responsibilities:

- inspect the user's first mailbox snapshot
- inspect Google OAuth credentials/scopes
- determine the UI state:
  - `needs_mailbox_connect`
  - `needs_reconnect`
  - `ready_to_sync`
  - `error`
  - `syncing`
  - `ready`
- auto-clear `reconnect_required` if credentials are valid again
- trigger a background catch-up using `syncAllMailboxes()`

Important point:

`GET /status` is not only a read.
It also acts like a lightweight "please catch me up in the background" signal.

### `POST /api/inbox/sync/start`

Handled in `src/worker/routes/inbox/sync/post.ts`.

Responsibilities:

- resolve mailbox
- reject if a sync lock is already live
- create a background full sync job
- optionally update mailbox sync window/cutoff before the sync starts

This calls `startFullGmailSync(...)`.

### `POST /api/inbox/sync/incremental`

Handled in `src/worker/routes/inbox/sync/post.ts`.

Responsibilities:

- resolve mailbox
- call `catchUpMailboxOnDemand(..., { force: true })`
- return whether the sync completed, was skipped, or failed

### `POST /api/inbox/sync/recover`

Handled in `src/worker/routes/inbox/sync/post.ts`.

Responsibilities:

- reset mailbox sync state
- start a background full resync

This is the "nuclear option" when history state is broken or the mailbox is stuck.

## Full Sync Flow

The full sync engine lives in `src/worker/lib/email/providers/google/sync.ts`, mainly in `startFullGmailSync(...)`.

### Step 1: Acquire lock

Full sync starts by acquiring the mailbox lock, unless the caller already did it and passed `skipLock: true`.

Locks are stored in `mailboxes.lockUntil`.
They are lease-based, not permanent.

### Step 2: Resolve sync window

The engine reads mailbox sync preferences and computes the effective cutoff.

Relevant helpers:

- `getMailboxSyncPreferences()`
- `resolveSyncCutoffAt()`
- `buildGmailQueryFromCutoff()`

The cutoff is translated into a Gmail search query like `after:YYYY/MM/DD`.

### Step 3: Get Gmail access token

The sync engine calls `getGmailTokenForMailbox(...)` in `client.ts`.

That function:

- loads the mailbox
- loads the linked auth account
- refreshes tokens if needed
- returns a valid access token

### Step 4: Capture history cursor before the full sync

The engine fetches the current Gmail `historyId` before listing messages.

This matters because the full sync can take time.
The engine later runs an incremental catch-up from that saved cursor so it does not miss changes that happened during the full sync window.

### Step 5: List all message ids

The engine pages through Gmail message ids with `listMessagesPage(...)`.

Only ids are listed first.
Actual message bodies are fetched later in batches.

### Step 6: Fetch and process messages in chunks

The engine calls `processMessageIds(...)` with the full list of message ids.

This is the core normalization pipeline.

### Step 7: Persist new history cursor

After full sync processing finishes:

- if the pre-sync `historyId` exists, run an incremental pass from that cursor
- otherwise persist the best known latest history id

This is what makes the full sync "safe" against changes arriving during the sync itself.

### Step 8: Release lock / finalize job state

The caller marks the job succeeded or failed and releases the mailbox lock.

## Incremental Sync Flow

Incremental sync also lives in `src/worker/lib/email/providers/google/sync.ts`.

Key functions:

- `runIncrementalGmailSync(...)`
- `runIncrementalGmailSyncWithAccessToken(...)`
- `catchUpMailboxOnDemand(...)`

### Preconditions

Incremental sync requires a mailbox `historyId`.
If there is no history cursor yet, the engine skips incremental sync and requires a full sync.

### Gmail history processing

The engine pages through Gmail history using `listHistoryPage(...)`.

For each page it derives:

- changed message ids
- deleted message ids

Deleted message ids are removed from D1.
Changed message ids are re-fetched and normalized via `processMessageIds(...)` in refresh mode.

### History expiration fallback

If Gmail returns `404` for the history cursor, the client throws `GmailHistoryExpiredError`.

In `catchUpMailboxOnDemand(...)`, that error triggers an automatic fallback to full sync.

### Failure escalation

If a mailbox accumulates too many consecutive failed sync jobs, on-demand catch-up escalates to a full sync.

Current threshold:

- `ESCALATE_TO_FULL_SYNC_AFTER = 5`

### Throttling

On-demand incremental catch-up skips if the mailbox synced too recently unless `force: true` is passed.

Current minimum interval:

- `ON_DEMAND_SYNC_MIN_INTERVAL_MS = 60_000`

## How `processMessageIds(...)` Works

This is the most important function in the sync pipeline.

Input:

- D1 database
- Gmail access token
- user id
- mailbox id
- list of provider message ids
- flags like `refreshExisting`, `applyFilters`, `minDateMs`

Behavior:

### 1. Load existing rows

The function looks up existing D1 rows for the message ids in the current chunk.

This is used to:

- skip already-known messages during full sync
- update known rows during incremental sync
- delete rows if a message disappears during refresh

### 2. Fetch Gmail messages in batch

Messages are fetched in chunks using Gmail batch requests.

Formats:

- `minimal` for refresh/update paths
- `full` for new messages

If a minimal response is insufficient to extract content, the code re-fetches the message in full format.

### 3. Enforce sync cutoff

Messages older than the active cutoff are skipped.

If an old message already exists and the engine is refreshing, it may be deleted from D1 so the local dataset respects the configured window.

### 4. Parse message metadata

The engine extracts:

- thread id
- RFC `Message-ID`
- sender/recipient headers
- subject/snippet
- plain text and HTML bodies
- label ids
- attachment presence
- unsubscribe headers
- sent vs received direction
- read state from `UNREAD`

Attachment existence is also reflected in the synthetic local label:

- `HAS_ATTACHMENT`

### 5. Upsert D1 rows

For each message:

- update the row if it already exists
- insert it if it is new

New incoming messages are also queued for:

- AI classification
- user filter application
- subscription tracking

### 6. Run AI labeling and filter matching

If `env.AI` is available and there are new incoming messages:

- load enabled user filters
- classify messages in batches via `classifyEmails(...)`
- write `aiLabel`
- optionally apply filter-driven state changes

Current filter effects include things like:

- mark read
- archive
- trash
- star
- override AI label

### 7. Update subscription state

If a received message had unsubscribe metadata, the engine sends events to `syncEmailSubscriptions(...)`.

This keeps `email_subscriptions` current and supports unsubscribe workflows.

### 8. Heartbeat and pacing

During chunk processing the engine:

- updates progress callbacks when provided
- refreshes the mailbox lock heartbeat
- sleeps between chunks

That keeps the lock alive and avoids hammering Gmail.

## Gmail Client Layer

The low-level Gmail client in `src/worker/lib/email/providers/google/client.ts` is responsible for:

- token retrieval and refresh
- generic Gmail HTTP requests
- rate-limit retries
- retry-after handling
- history listing
- message listing
- single message fetch
- batched message fetch

Important behavior:

- 401 from Gmail becomes reconnect-required
- 404 on `/history` becomes `GmailHistoryExpiredError`
- 403/429 rate-limit conditions are retried with backoff and jitter

## Mailbox Parsing / Sending Layer

`src/worker/lib/email/providers/google/mailbox.ts` handles:

- decoding Gmail body payloads
- extracting `text/plain` and `text/html`
- extracting attachment metadata
- fetching attachment bytes
- composing raw MIME messages for outgoing sends
- sending mail through Gmail
- batch label modification

This file is where most Gmail-specific MIME/body/attachment logic lives.

## Mailbox State, Locks, and Jobs

Shared mailbox/job state is managed in `src/worker/lib/email/mailbox-state.ts`.

### Locks

Locks are stored on the mailbox row with `lockUntil`.

Key behaviors:

- `acquireMailboxSyncLock()` acquires the lease if it is expired or empty
- `touchMailboxSyncLock()` extends the lease during long-running sync work
- `releaseMailboxSyncLock()` clears it on completion
- `expireStaleSyncJobs()` marks abandoned running jobs as failed

Current TTL:

- `SYNC_LOCK_TTL_MS = 4 minutes`

### Jobs

Each sync execution gets a `sync_jobs` row.

Important helpers:

- `createSyncJob()`
- `updateSyncJobProgress()`
- `markSyncJobSucceeded()`
- `markSyncJobFailed()`
- `countConsecutiveFailedJobs()`
- `getMailboxSyncSnapshot()`

Mailbox state is updated alongside job state:

- success clears errors and marks `authState = "ok"`
- reconnect-required errors set `authState = "reconnect_required"`
- stale locks are converted into failed jobs automatically

## Where Send / Read Interact With Sync

Sync is not only driven by the dedicated sync endpoints.

### Send path

After a successful send in `src/worker/routes/inbox/emails/post.ts`:

- the provider sends the message
- the route calls `provider.syncMessageIds(...)`
- that maps to `syncGmailMessageIds(...)`

This is how sent mail gets projected back into D1 soon after sending.

### Live email detail

`src/worker/routes/inbox/emails/get.ts` supports `refreshLive=true`.

That path does **not** run a full D1 sync.
It directly asks the provider for the live Gmail message, extracts bodies/attachments, and merges the result into the response.

This is useful for detail freshness without forcing a broader sync.

## Filters and AI Labels

The app has two layers of email categorization:

1. AI labels
   Generated by `classifyEmails(...)`

2. User filters
   Loaded from `email_filters`

Current flow:

- only new received messages are sent to the classifier
- AI classification returns one category per message
- the classifier can also match user filter ids in the same pass
- matched filters can mutate local message state after insert

This means sync is not only mirroring Gmail.
It is also enriching incoming mail with app-level semantics.

## Subscriptions / Unsubscribe Metadata

Subscription tracking is built into sync.

During message processing:

- the engine parses `List-Unsubscribe`
- extracts `http(s)` or `mailto:` unsubscribe targets
- normalizes them
- stores them on the email row
- aggregates sender-level events into `email_subscriptions`

This is why unsubscribe features do not need to rediscover metadata later.

## Debugging Guide

### "User connected Google but no mailbox exists"

Start with:

- `src/worker/routes/settings/get.ts`
- `src/worker/lib/email/mailbox-state.ts`

Check:

- `ensureMailbox()`
- `mailboxes.accountId`
- whether the account has enough Gmail scopes

### "Sync says reconnect required"

Start with:

- `src/worker/lib/email/providers/google/errors.ts`
- `src/worker/routes/inbox/sync/get.ts`
- `src/worker/lib/email/mailbox-state.ts`

Check:

- `mailboxes.authState`
- account access token / refresh token
- latest `sync_jobs.errorClass`

### "Incremental sync stopped working"

Start with:

- `mailboxes.historyId`
- `src/worker/lib/email/providers/google/sync.ts`

Check for:

- missing `historyId`
- `GmailHistoryExpiredError`
- repeated failures causing full-sync escalation

### "A sent message did not appear in the inbox DB"

Start with:

- `src/worker/routes/inbox/emails/post.ts`
- `src/worker/lib/email/providers/google/sync.ts`

Check:

- send succeeded and returned a provider message id
- `syncGmailMessageIds(...)` was called
- the sent message was not filtered out by cutoff logic

### "Filters or AI labels are not being applied"

Start with:

- `src/worker/lib/email/ai-classifier.ts`
- `src/worker/lib/email/user-filters.ts`
- `processMessageIds(...)` in Google sync

Check:

- `env.AI` is present
- the message is new and received
- user filters are enabled

### "Attachments exist in Gmail but not in UI"

Start with:

- `src/worker/lib/email/providers/google/mailbox.ts`
- `src/worker/routes/inbox/emails/get.ts`
- `src/worker/routes/inbox/emails/get-attachment.ts`

Check:

- whether `HAS_ATTACHMENT` was added
- whether `refreshLive=true` returns live attachments
- whether the provider fetch path succeeds

## Current Limitations

- Only the Google provider is implemented for sync.
- `createEmailProvider()` is provider-ready, but Outlook sync does not exist yet.
- Search is still separate from sync architecture and is not yet built on FTS.
- Some response schemas in route files are currently declared but unused.

## Suggested Reading Order For New Developers

If you are onboarding, read in this order:

1. `src/worker/routes/inbox/sync/get.ts`
2. `src/worker/routes/inbox/sync/post.ts`
3. `src/worker/lib/email/sync.ts`
4. `src/worker/lib/email/mailbox-state.ts`
5. `src/worker/lib/email/providers/google/sync.ts`
6. `src/worker/lib/email/providers/google/client.ts`
7. `src/worker/lib/email/providers/google/mailbox.ts`
8. `src/worker/db/schema.ts`

That sequence gives you:

- the product entrypoints first
- then the provider-neutral orchestration
- then the real Gmail engine
- then the persistence model

## Short Summary

Petit sync is currently:

- provider-routed through `lib/email`
- implemented for Gmail under `lib/email/providers/google`
- lock/job driven through `mailboxes` and `sync_jobs`
- full-sync + history-based incremental sync
- enriched during ingestion with AI labels, user filters, and unsubscribe metadata

If you understand `mailbox-state.ts`, `routes/inbox/sync/*.ts`, and `providers/google/sync.ts`, you understand almost all of the live sync system.
