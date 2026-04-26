# Privacy

_Last updated: April 26, 2026._

This page is the plain-English version of how Duomo handles your data. The short version: your inbox lives in your browser, not in our database. The long version is below.

## What we don't store

We do not keep a copy of your inbox on our servers. When you open Duomo, we fetch your messages from Gmail and store them in a local database that lives inside your browser (IndexedDB / SQLite-WASM). Closing the tab does not send that data to us. Logging out clears it.

Specifically, our database has **no `emails` table**. Subjects, bodies, snippets, recipients, threads, and labels never reach our storage layer.

## What we do store

Some things must live on our servers for the product to work. We list them here so there are no surprises.

- **Account.** Your name, email address, and Google OAuth tokens. The tokens let Duomo talk to Gmail on your behalf. They are encrypted at rest by Cloudflare D1.
- **Mailbox metadata.** Your signature, templates, sync cursor, and connection state. No message content.
- **Drafts.** When you compose a message, the draft is saved on our servers so it can sync across devices and survive a closed tab. Stored encrypted at rest.
- **Scheduled sends.** When you schedule a message, we keep its body until the send fires. Stored encrypted at rest. Deleted after delivery.
- **Attachments.** Files you attach are uploaded to a private Cloudflare R2 bucket. Only your account can read them.
- **Trust list.** The senders you have approved, blocked, or screened. We store the address — never the message that triggered the decision.
- **Sessions.** Standard auth cookie data: session token, IP, user agent. Used to keep you signed in.

## AI features and OpenAI

Duomo includes optional AI features for composing and triaging email: rewrite, grammar check, and thread classification.

When you trigger one of these features, the relevant text — the draft you are rewriting, or the thread being classified — is sent to OpenAI for that single request. OpenAI's API does not retain prompt or completion data for training purposes when called this way.

If you do not use these features, no email content reaches OpenAI.

## Subprocessors

Duomo runs on:

- **Cloudflare** — Workers (compute), D1 (database), R2 (attachments), Queues (sync jobs).
- **Google** — Gmail API and Google OAuth.
- **OpenAI** — only when you use an AI feature.

That is the complete list.

## What we do not do

- We do not show ads.
- We do not sell or share your data.
- We do not run third-party analytics or tracking pixels.
- We do not read your mail. The only programmatic access to message content is the rendering pipeline that delivers it back to your own browser.

## Your rights

You can disconnect Gmail, delete your account, and remove your data at any time from Settings. Account deletion removes everything we store on our side. Local cached mail is wiped from your browser when you log out.

For data requests under GDPR, CCPA, or any other regime, write to the address in the footer.

## Changes

If we change anything material on this page, we will note it at the top with a new date. Substantive changes will also be announced in-app.
