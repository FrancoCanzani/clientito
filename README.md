# Duomo

Duomo is a private, local-first Gmail focus inbox.

The product promise for beta is narrow: screen new senders, process active mail, turn messages into to-dos, and keep the inbox cache in the browser instead of storing a server-side mail corpus.

## Beta Positioning

Duomo is for Gmail users who want an attention firewall before they want another AI assistant.

- **Private by default:** message lists, bodies, labels, and search state live in the browser-local SQLite database.
- **Screener first:** unknown senders can be accepted or rejected before they become inbox work.
- **Action queue:** Focus and To-do are the primary workflows; Inbox is the fallback view.
- **Assistive AI:** writing and classification features are optional and mailbox-scoped.
- **Gmail remains authoritative:** Duomo is a client on top of Gmail, so mail is not locked into Duomo.

## Architecture

- React + Vite frontend.
- Hono Cloudflare Worker API.
- Better Auth for sessions and Google OAuth.
- Cloudflare D1 for auth, mailbox settings, trust entities, split-view metadata, drafts, and scheduled sends.
- Cloudflare R2 for draft/scheduled-send attachments.
- Browser SQLite/OPFS for local email cache and search.
- Gmail API as the source of truth for messages.

## Scripts

```bash
bun run dev            # local dev server
bun run build          # typecheck + production build
bun run lint           # eslint
bun run check-types    # tsc project refs
bun run deploy         # build and deploy worker

bun run db:generate    # generate Drizzle migration
bun run db:migrate:dev # apply migration to local D1
bun run db:migrate:prod # apply migration to remote D1
bun run db:reset:dev   # reset local D1 state and re-apply migrations
```

## Launch Bar

Before public beta, the core flows must be reliable:

- Connect Gmail.
- Open Focus, To-do, Inbox, Search, Drafts, Screener, and Settings.
- Compose, reply, send, schedule, cancel, attach, archive, trash, mark read/unread, star, snooze, and label.
- Clear local cache and recover from reconnect-required state.
- Delete account and remove server-side user data plus uploaded attachment objects.
