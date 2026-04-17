import { and, eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { DEFAULT_SYNC_WINDOW_MONTHS, resolveSyncCutoffAt } from "./sync/preferences";

async function getCurrentGoogleAccounts(db: Database, userId: string) {
  const allGoogleAccounts = await db
    .select({
      id: account.id,
      accountId: account.accountId,
      accessToken: account.accessToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      refreshToken: account.refreshToken,
      scope: account.scope,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));

  const seen = new Map<string, (typeof allGoogleAccounts)[number]>();
  for (const googleAccount of allGoogleAccounts) {
    const existing = seen.get(googleAccount.accountId);
    const isNewer =
      toTimestamp(googleAccount.createdAt) !== null &&
      toTimestamp(existing?.createdAt) !== null &&
      toTimestamp(googleAccount.createdAt)! > toTimestamp(existing?.createdAt)!;

    if (
      !existing ||
      (googleAccount.refreshToken && !existing.refreshToken) ||
      isNewer
    ) {
      seen.set(googleAccount.accountId, googleAccount);
    }
  }

  return [...seen.values()].sort(
    (a, b) => (toTimestamp(b.createdAt) ?? 0) - (toTimestamp(a.createdAt) ?? 0),
  );
}

function toTimestamp(value: Date | number | null | undefined): number | null {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : null;
}

const GMAIL_SCOPE_PREFIX = "https://www.googleapis.com/auth/gmail.";

function hasGmailScopes(scope: string | null | undefined): boolean {
  return typeof scope === "string" && scope.includes(GMAIL_SCOPE_PREFIX);
}

export async function ensureGoogleMailboxesForUser(
  db: Database,
  userId: string,
) {
  const googleAccounts = await getCurrentGoogleAccounts(db, userId);
  const gmailAccounts = googleAccounts.filter((a) => hasGmailScopes(a.scope));

  for (const googleAccount of gmailAccounts) {
    await ensureMailbox(db, userId, googleAccount.id);
  }

  return gmailAccounts;
}

export async function resolveMailbox(
  db: Database,
  userId: string,
  mailboxId?: number,
) {
  if (mailboxId) {
    const mb = await db.query.mailboxes.findFirst({
      where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, userId)),
    });
    return mb ?? null;
  }

  const userMailboxes = await db
    .select()
    .from(mailboxes)
    .where(eq(mailboxes.userId, userId));
  if (userMailboxes[0]) return userMailboxes[0];

  const googleAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
  });
  return ensureMailbox(db, userId, googleAccount?.id ?? null);
}

export async function ensureMailbox(
  db: Database,
  userId: string,
  accountId?: string | null,
  email?: string | null,
) {
  if (accountId) {
    const existing = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.accountId, accountId),
    });

    if (existing) {
      if (email && existing.email !== email) {
        await db
          .update(mailboxes)
          .set({ email, updatedAt: Date.now() })
          .where(eq(mailboxes.id, existing.id));
        return { ...existing, email };
      }
      return existing;
    }

    const now = Date.now();
    const inserted = await db
      .insert(mailboxes)
      .values({
        userId,
        accountId,
        email: email ?? null,
        authState: "unknown",
        syncWindowMonths: DEFAULT_SYNC_WINDOW_MONTHS,
        syncCutoffAt: resolveSyncCutoffAt(DEFAULT_SYNC_WINDOW_MONTHS),
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();

    return (
      inserted[0] ??
      (await db.query.mailboxes.findFirst({
        where: eq(mailboxes.accountId, accountId),
      }))
    );
  }

  const existing = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.userId, userId),
  });

  if (existing) {
    if (email && existing.email !== email) {
      await db
        .update(mailboxes)
        .set({ email, updatedAt: Date.now() })
        .where(eq(mailboxes.id, existing.id));
      return { ...existing, email };
    }
    return existing;
  }

  const now = Date.now();
  const inserted = await db
    .insert(mailboxes)
    .values({
      userId,
      email: email ?? null,
      authState: "unknown",
      syncWindowMonths: DEFAULT_SYNC_WINDOW_MONTHS,
      syncCutoffAt: resolveSyncCutoffAt(DEFAULT_SYNC_WINDOW_MONTHS),
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  return (
    inserted[0] ??
    (await db.query.mailboxes.findFirst({
      where: eq(mailboxes.userId, userId),
    }))
  );
}

export async function resolveOutgoingMailbox(
  db: Database,
  userId: string,
  mailboxId?: number,
) {
  if (mailboxId) {
    const mailbox = await resolveMailbox(db, userId, mailboxId);
    if (!mailbox) {
      throw new Error("Selected sender account not found.");
    }
    return mailbox;
  }

  const userMailboxes = await db
    .select()
    .from(mailboxes)
    .where(eq(mailboxes.userId, userId));
  if (userMailboxes.length === 1) {
    return userMailboxes[0];
  }
  if (userMailboxes.length > 1) {
    throw new Error("Select a sender account before sending.");
  }

  const mailbox = await resolveMailbox(db, userId);
  if (!mailbox) {
    throw new Error("No mailbox configured");
  }

  return mailbox;
}
