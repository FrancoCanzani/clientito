# Connect Your Mailbox

This guide covers mailbox connection, required permissions, and quick checks after connect.

## Before you begin

- You need active Google account.
- Pop-up blockers must allow auth window.
- If enterprise domain policy blocks OAuth, ask admin to allow app.

## Connect flow

1. Open onboarding or settings.
2. Choose connect mailbox.
3. Select Google account.
4. Approve requested permissions.
5. Return to Petit and wait for sync status to show ready.

## What to check after connect

- Inbox list loads.
- Search returns results.
- Draft creation works.
- Settings shows connected mailbox email.

## If reconnect is required

You may see reconnect state after token revoke, password/security change, or expired consent.

1. Open Settings.
2. Click reconnect for affected mailbox.
3. Re-authorize same account.
4. Retry sync.

## Common failures

- Auth window closes with error: retry from settings and check browser cookie/privacy settings.
- Permission denied: account policy or user denied scope.
- Connected but no mail appears: run sync and review [Sync Troubleshooting](/docs/sync-troubleshooting).

## Related pages

- [Getting Started](/docs/getting-started)
- [Sync Troubleshooting](/docs/sync-troubleshooting)
- [Security and Privacy](/docs/security-and-privacy)
