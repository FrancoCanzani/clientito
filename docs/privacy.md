# Privacy

_Last updated: May 6, 2026._

I run Duomo. I built it because every other email client treats your inbox like a marketing funnel. This page tells you exactly what data Duomo touches and what it does with it. No legalese where I can avoid it. No "we may collect" hand-waving. The list of what's stored is exhaustive — if it's not on this page, it's not stored.

If you want to argue with anything here, write to **privacy@duomo.app**.

## The short version

- Duomo does **not** store your email. No subjects, no bodies, no recipients, no attachments from received mail. Your inbox is fetched live from Gmail and cached in your browser.
- The only message bodies that ever sit in our database are **drafts you're writing** and **messages you've scheduled to send later**. Nothing else.
- AI features (rewrite, grammar, classify) call OpenAI **only when you click the button**. Don't click, nothing leaves.
- No ads. No analytics SDKs. No tracking pixels. No selling, sharing, or anything that resembles selling.
- You can delete everything from Settings. It's instant.

## What's stored, table by table

I'm going to list every database table and every column in it, because that's the only way you can actually verify this.

The database is Cloudflare D1 (SQLite). It has at-rest encryption at the storage layer, but I do not add an extra encryption pass on top of that. I'm telling you because the last version of this page implied I did, and I don't want to lie to you.

### `user`

Created when you sign in.

- `id`, `name`, `email`, `email_verified`, `image` (your Google avatar URL)
- `created_at`, `updated_at`

### `session`

Created when you sign in. Used to keep you signed in.

- `id`, `token` (random, opaque), `expires_at`
- `ip_address` and `user_agent` of the device that signed in (helps spot suspicious sign-ins)
- `user_id`, `created_at`, `updated_at`

Sessions expire after 30 days of inactivity. Logging out deletes the row.

### `account`

The OAuth connection to Google. **This is the row that lets Duomo talk to Gmail on your behalf.**

- `id`, `account_id` (Google's), `provider_id` (always `google`)
- `access_token`, `refresh_token`, `id_token`, `scope`, `access_token_expires_at`, `refresh_token_expires_at`
- `password` (always null for Google sign-ins; the column exists because the auth library declares it)
- `user_id`, `created_at`, `updated_at`

These tokens are stored as plain text columns inside D1. D1 is encrypted at rest. There is no second app-level encryption layer. If you'd rather not trust that, the only mitigation is to not connect — Duomo cannot work without OAuth tokens.

### `verification`

Short-lived rows used during the OAuth handshake. Self-deleting after `expires_at` (typically 10 minutes).

### `mailboxes`

One row per Gmail account you've connected.

- `id`, `user_id`, `account_id`, `provider` (`google`), `email` (your Gmail address)
- `signature` (the signature text you've saved)
- `templates` (the canned-reply templates you've saved, stored as JSON)
- `history_id` (Gmail's incremental-sync cursor; an opaque number)
- `sync_window_months`, `sync_cutoff_at` (how far back to sync)
- `ai_enabled`, `ai_classification_enabled` (your AI toggles)
- `auth_state` (`ok`, `reconnect_required`, etc.), `last_successful_sync_at`, `last_error_at`, `last_error_message`
- `updated_at`

`last_error_message` is a string from Gmail or our sync pipeline. It can occasionally contain a Gmail message ID (for example, "couldn't fetch message 18a3f2c…"). It does not contain message bodies.

### `drafts`

Messages you're composing. Saved server-side so they sync between devices and survive a tab close.

- `id`, `user_id`, `compose_key` (which composer the draft belongs to), `mailbox_id`
- `to_addr`, `cc_addr`, `bcc_addr`, `subject`
- `body` (the HTML you're typing)
- `forwarded_content` (the original message you're forwarding, if any)
- `thread_id` (Gmail thread, if you're replying)
- `attachment_keys` (pointers into the R2 bucket — not the file bytes)
- `created_at`, `updated_at`

Sending a draft via Gmail moves it out of this table. Discarding deletes the row. Idle drafts older than 90 days are deleted by a daily cleanup job.

### `scheduled_emails`

Messages you've queued to send at a future time.

- `id`, `user_id`, `mailbox_id`
- `to`, `cc`, `bcc`, `subject`, `body`
- `in_reply_to`, `references`, `thread_id`, `attachment_keys`
- `scheduled_for` (when to send)
- `status` (`pending` / `sent` / `failed` / `cancelled`)
- `retry_count`, `error`, `created_at`

Once a scheduled message is delivered, the row is marked `sent`. The body column is cleared on the next cleanup pass (within 24 hours of delivery).

### `trust_entities`

The screener / gatekeeper list — senders and domains you've approved or blocked.

- `id`, `user_id`, `mailbox_id`, `entity_type` (`sender` or `domain`), `entity_value` (the address or domain), `trust_level` (`trusted` or `blocked`)
- `created_at`, `updated_at`

Just the address. Not the message that triggered your decision.

### `split_views`

The custom inbox views you create (the smart folders, basically).

- `id`, `user_id`, `name`, `description`, `icon`, `color`, `position`, `visible`, `pinned`, `is_system`, `system_key`
- `rules` (JSON: domains, senders, recipients, subject substrings, has-attachment flag, mailing-list flag, Gmail label IDs)
- `match_mode`, `show_in_other`, `created_at`, `updated_at`

The `rules` column can contain sender addresses, domain names, and subject keywords because that's what you typed in. It does not contain message bodies.

That's the whole database. Eight tables. Five of them belong to authentication or account housekeeping; three of them — `drafts`, `scheduled_emails`, `trust_entities` — are the only ones that touch anything resembling email content, and only because you typed it in.

## Files: the R2 bucket

When you attach a file to a draft or scheduled email, the bytes go into a private Cloudflare R2 bucket called `petit-attachments`. Each object is keyed by your account so nobody else's session can read it.

The `attachment_keys` columns in `drafts` and `scheduled_emails` are pointers into this bucket. When the parent row is deleted, the corresponding objects are deleted too.

Files **received** as attachments to your incoming mail never enter this bucket. They are streamed from Gmail to your browser on demand.

## Queues

There's a Cloudflare Queue called `email-label-mutations` that buffers label changes (mark-read, archive, snooze, etc.) so they survive transient Gmail API failures. Each message in the queue contains:

- `mailboxId`, `providerMessageIds` (the Gmail-issued IDs of the messages being changed), `addLabelIds`, `removeLabelIds`

That's it. No subjects, no bodies. Messages stay in the queue until they succeed (typically seconds) or hit the dead-letter queue after five retries.

## Logs

Cloudflare Workers observability is on. It records: request path, HTTP status, response time, and any `console.log`/`console.error` we emit. Some of those error logs include a Gmail message ID or a sender address (for example, "block-sender filter failed for x@y.com"). Logs are retained for **7 days** and then purged by Cloudflare.

No message bodies are logged.

## Your browser

Some things only ever live in your browser, never on a server:

- **OPFS / SQLite-WASM** — the local cache of your inbox. Subjects, bodies, snippets, threads, labels, search index. This is where the "your inbox lives in your browser" claim comes from. Logging out deletes this.
- **`localStorage`** — two keys, both UI state:
  - `petit-theme` — light / dark / system
  - `petit.activeMailboxId` — which mailbox you had open last
- **Cookies** — a single session cookie set by the auth library. `HttpOnly`, `Secure`, `SameSite=Lax`. No third-party cookies, no advertising cookies, no fingerprinting.

## Gmail access

When you connect Gmail, Google asks for four scopes. Here's what each one does and where in the app it's used:

- **`gmail.readonly`** — read messages and threads so we can show them to you. Used by the inbox sync and the rendering pipeline.
- **`gmail.modify`** — change labels: mark read, archive, trash, snooze, to-do. Used every time you act on a message.
- **`gmail.send`** — send the messages you compose. Used when you hit Send.
- **`gmail.settings.basic`** — create the Gmail filter that powers "Block sender". Only used when you block someone.

You can revoke these any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), or hit "Disconnect" in Duomo's Settings. Disconnecting deletes the row in `account` and stops every sync.

### Google's required disclosure

Duomo's use of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the **Limited Use** requirements. Concretely:

- Google user data is used only to provide and improve the user-facing features of Duomo.
- It is not transferred to anyone except the subprocessors below, when required by law, or as part of a merger/acquisition with notice to you.
- It is never used for advertising.
- A human only ever reads it with your explicit consent for a specific message, for security investigation, or when required by law.

## AI features

Three features call out to OpenAI. All of them are off until you click:

- **Rewrite** — the draft text you're rewriting.
- **Grammar check** — the draft text you're checking.
- **Classify** — the metadata of the thread being classified (subject, sender, date, snippet — not full bodies).

These calls go to OpenAI's standard API, which under their [API data policy](https://openai.com/policies/api-data-usage-policies) does not retain prompt or completion data for training. You can disable AI per mailbox in Settings, which prevents the buttons from doing anything.

## Subprocessors

The full list of services Duomo's data passes through:

- **Cloudflare** — Workers (compute), D1 (database), R2 (attachments), Queues (label-change buffer), observability (logs). US-headquartered, runs on a global edge network.
- **Google** — Gmail API, Google OAuth, Google sign-in.
- **OpenAI** — only when you trigger an AI feature.

That's it. There is no analytics service, no error-tracking service, no email-deliverability service, no support-ticketing service, no marketing service. If I ever add one, this list updates first.

## Where the data physically lives

Cloudflare D1 stores your data in the region closest to where the database was first created (currently the United States) and replicates it for durability. R2 is globally distributed object storage, also primarily in the US. If you're in the EU, your requests are typically served from EU edge locations, but the underlying data is in the US, and the SCC-based protections in Cloudflare's [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) apply.

## Security, honestly

- All traffic is over TLS 1.2+.
- D1 is encrypted at rest by Cloudflare. Tokens, drafts, and scheduled-send bodies live there. **There is no app-level encryption layer on top.** This is normal for the type of app, but I want it documented.
- R2 attachments are private and access-scoped to your session.
- I (the operator) do not have a way to read your Gmail. The OAuth tokens in `account` would let me, in principle — that's true of any email client — but there's no internal tool that does that, and any access for security investigation would be logged. If that's not enough trust for your situation, don't use Duomo or any other email client that holds OAuth tokens.
- If we ever discover a breach affecting your data, you'll hear from us within 72 hours.

## Your rights

You have these no matter where you live:

- **See it** — Settings → Export gives you everything we hold as JSON.
- **Fix it** — name, signature, templates, trust list, split views are all editable in Settings.
- **Delete it** — Settings → Delete account drops every row and every R2 object. Local browser cache is wiped on logout.
- **Disconnect** — revokes OAuth tokens and stops all sync, without deleting your account.

GDPR adds: the right to object, the right to restrict processing, the right to lodge a complaint with your supervisory authority, and the right to ask the legal basis for processing. CCPA adds the right to know, delete, correct, and opt out of "sale or sharing" of personal information — Duomo does not sell or share personal information.

For any of the above, write to **privacy@duomo.app**. I respond within 30 days, usually faster.

## Children

Duomo is not for anyone under 16. If you're a parent and your kid signed up, write to **privacy@duomo.app** and I'll delete the account.

## Changes

If anything material on this page changes, the date at the top updates and I'll tell you in-app. If you don't like the change, the disconnect/delete options in Settings are right there.

## Contact

- **Privacy and data questions:** privacy@duomo.app
- **Security disclosures:** security@duomo.app
- **Anything else:** hello@duomo.app

Operator: Franco Canzani. Sole proprietor pending incorporation. Postal address available on request.
