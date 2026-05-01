# Sync Troubleshooting

Use this page when mailbox data looks stale, missing, or broken.

## Quick focus checks

1. Confirm correct mailbox selected.
2. Check network and refresh app.
3. Open sync status.
4. If reconnect required, reconnect account.
5. Retry incremental sync.

## Symptom: no new emails

Possible causes:

- sync job failed
- auth token invalid
- provider rate limit

Actions:

1. Trigger sync from app.
2. Wait for completion.
3. If still stale, reconnect mailbox.

## Symptom: missing old emails

Possible causes:

- sync window cutoff
- history cursor gap and recovery pending

Actions:

1. Trigger full or recovery sync from sync controls.
2. Re-check thread by search after sync completes.

## Symptom: attachment cannot open

Possible causes:

- provider fetch error
- stale local pointer

Actions:

1. Refresh thread.
2. Retry attachment open.
3. If persistent, reconnect mailbox and run sync.

## Reconnect flow

1. Go to Settings.
2. Find affected mailbox.
3. Reconnect account.
4. Run sync again.

## When to escalate

Escalate if any remains after reconnect + retry:

- repeated sync failures
- repeated missing threads
- repeated send/draft inconsistencies

Include mailbox id, rough timestamp, and failing action.

## Related pages

- [Connect Your Mailbox](/docs/connect-your-mailbox)
- [Inbox and Search](/docs/inbox-and-search)
- [Email Sync Architecture](/docs/email-sync)
