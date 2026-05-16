import { and, eq } from "drizzle-orm";
import { account, session } from "../../db/auth-schema";
import type { Database } from "../../db/client";
import {
  aiThreadIntelligence,
  aiUsageEvents,
  mailboxes,
  replyReminders,
  scheduledEmails,
  trustEntities,
} from "../../db/schema";
import type { GoogleToken } from "../google/oauth";

export type ConnectGoogleAccountResult =
  | { kind: "created" }
  | { kind: "refreshed" }
  | { kind: "rehome"; sourceUserId: string };

export async function connectGoogleAccount({
  db,
  currentUserId,
  providerAccountId,
  tokens,
}: {
  db: Database;
  currentUserId: string;
  providerAccountId: string;
  tokens: GoogleToken;
}): Promise<ConnectGoogleAccountResult> {
  const existingAccount = await db.query.account.findFirst({
    where: and(
      eq(account.providerId, "google"),
      eq(account.accountId, providerAccountId),
    ),
  });
  const tokenPatch = buildTokenPatch(tokens);

  if (!existingAccount) {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: providerAccountId,
      providerId: "google",
      userId: currentUserId,
      ...tokenPatch,
    });
    return { kind: "created" };
  }

  if (existingAccount.userId === currentUserId) {
    await db
      .update(account)
      .set(tokenPatch)
      .where(eq(account.id, existingAccount.id));
    return { kind: "refreshed" };
  }

  await rehomeExistingGoogleAccount({
    db,
    existingAccountId: existingAccount.id,
    sourceUserId: existingAccount.userId,
    targetUserId: currentUserId,
    tokenPatch,
  });
  return { kind: "rehome", sourceUserId: existingAccount.userId };
}

function buildTokenPatch(tokens: GoogleToken) {
  return {
    accessToken: tokens.access_token,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    ...(tokens.expires_in
      ? {
          accessTokenExpiresAt: new Date(
            Date.now() + tokens.expires_in * 1000,
          ),
        }
      : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
    updatedAt: new Date(),
  };
}

async function rehomeExistingGoogleAccount({
  db,
  existingAccountId,
  sourceUserId,
  targetUserId,
  tokenPatch,
}: {
  db: Database;
  existingAccountId: string;
  sourceUserId: string;
  targetUserId: string;
  tokenPatch: ReturnType<typeof buildTokenPatch>;
}) {
  await db
    .update(account)
    .set({ userId: targetUserId, ...tokenPatch })
    .where(eq(account.id, existingAccountId));

  const linkedMailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.accountId, existingAccountId),
  });
  if (linkedMailbox) {
    await db
      .update(mailboxes)
      .set({ userId: targetUserId, updatedAt: Date.now() })
      .where(eq(mailboxes.id, linkedMailbox.id));
    await moveMailboxScopedRows(db, linkedMailbox.id, targetUserId);
  }

  const remainingSourceAccounts = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, sourceUserId));
  if (remainingSourceAccounts.length === 0) {
    await db.delete(session).where(eq(session.userId, sourceUserId));
  }
}

async function moveMailboxScopedRows(
  db: Database,
  mailboxId: number,
  targetUserId: string,
) {
  await db
    .update(scheduledEmails)
    .set({ userId: targetUserId })
    .where(eq(scheduledEmails.mailboxId, mailboxId));
  await db
    .update(trustEntities)
    .set({ userId: targetUserId })
    .where(eq(trustEntities.mailboxId, mailboxId));
  await db
    .update(replyReminders)
    .set({ userId: targetUserId })
    .where(eq(replyReminders.mailboxId, mailboxId));
  await db
    .update(aiUsageEvents)
    .set({ userId: targetUserId })
    .where(eq(aiUsageEvents.mailboxId, mailboxId));
  await db
    .update(aiThreadIntelligence)
    .set({ userId: targetUserId })
    .where(eq(aiThreadIntelligence.mailboxId, mailboxId));
}
