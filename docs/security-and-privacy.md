# Security and Privacy

This page explains core security and privacy expectations in Petit.

## Account and auth

- User authentication handled through app auth system.
- Mailbox access uses OAuth authorization with Google.
- Reconnect may be required after token revoke or policy change.

## Data handling

- Petit reads mailbox data needed for inbox features.
- Message metadata and content may be stored for app functionality.
- Attachments and sync state may be processed as part of mailbox sync.

## AI features

- AI capabilities support actions like rewrite or summary workflows.
- AI output can be wrong; user should review before sending.
- AI features should be treated as assistive, not autonomous authority.

## Access model

- Access is scoped to signed-in user context.
- Mailbox operations are executed within that user authorization context.

## User safety habits

- Review permissions during mailbox connect.
- Revoke and reconnect account if suspicious behavior appears.
- Verify AI-generated content before sending.

## Incident response baseline

If you suspect account compromise:

1. Revoke connected account access from Google.
2. Re-authenticate and reconnect mailbox.
3. Rotate sensitive credentials.
4. Notify support/ops with timestamp and affected mailbox.

## Related pages

- [Connect Your Mailbox](/docs/connect-your-mailbox)
- [Sync Troubleshooting](/docs/sync-troubleshooting)
