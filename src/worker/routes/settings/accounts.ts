import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { account } from "../../db/auth-schema";
import { mailboxes } from "../../db/schema";
import { getGmailToken, hasUsableAccessToken } from "../../lib/gmail/client";
import { ensureMailbox, getUserMailboxes } from "../../lib/gmail/mailbox-state";
import type { AppRouteEnv } from "../types";

const deleteAccountParamsSchema = z.object({
  accountId: z.string().min(1),
});

async function resolveGmailEmail(
  db: Parameters<typeof getGmailToken>[0],
  accountPk: string,
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
): Promise<string | null> {
  try {
    const token = await getGmailToken(db, accountPk, env);
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { email?: string };
    return info.email ?? null;
  } catch {
    return null;
  }
}

export function registerAccountSettings(api: Hono<AppRouteEnv>) {
  api.get("/accounts", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const allGoogleAccounts = await db
      .select({
        id: account.id,
        accountId: account.accountId,
        accessToken: account.accessToken,
        accessTokenExpiresAt: account.accessTokenExpiresAt,
        refreshToken: account.refreshToken,
        scope: account.scope,
      })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "google")));

    const seen = new Map<string, (typeof allGoogleAccounts)[number]>();
    for (const ga of allGoogleAccounts) {
      const existing = seen.get(ga.accountId);
      if (!existing || (ga.refreshToken && !existing.refreshToken)) {
        seen.set(ga.accountId, ga);
      }
    }
    const googleAccounts = [...seen.values()];

    for (const ga of googleAccounts) {
      const mb = await ensureMailbox(db, user.id, ga.id);
      if (mb && !mb.gmailEmail && (ga.refreshToken || hasUsableAccessToken(ga))) {
        const email = await resolveGmailEmail(db, ga.id, c.env);
        if (email) {
          await ensureMailbox(db, user.id, ga.id, email);
        }
      }
    }

    const userMailboxes = await getUserMailboxes(db, user.id);
    const mailboxByAccountId = new Map(
      userMailboxes
        .filter((mb) => mb.accountId)
        .map((mb) => [mb.accountId!, mb]),
    );

    const accounts = googleAccounts.map((ga) => {
      const mb = mailboxByAccountId.get(ga.id);
      return {
        accountId: ga.id,
        mailboxId: mb?.id ?? null,
        gmailEmail: mb?.gmailEmail ?? null,
        authState: mb?.authState ?? "unknown",
        lastSync: mb?.lastSuccessfulSyncAt ?? null,
        hasSynced: Boolean(mb?.historyId),
        hasValidCredentials:
          Boolean(ga.refreshToken) || hasUsableAccessToken(ga),
      };
    });

    return c.json({ data: { accounts } }, 200);
  });

  api.delete("/accounts/:accountId", zValidator("param", deleteAccountParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { accountId } = c.req.valid("param");

    const targetAccount = await db.query.account.findFirst({
      where: and(
        eq(account.id, accountId),
        eq(account.userId, user.id),
        eq(account.providerId, "google"),
      ),
    });

    if (!targetAccount) {
      return c.json({ error: "Account not found" }, 404);
    }

    const allGoogleAccounts = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "google")));

    if (allGoogleAccounts.length <= 1) {
      return c.json({ error: "Cannot remove last connected account" }, 400);
    }

    await db.delete(mailboxes).where(eq(mailboxes.accountId, accountId));
    await db.delete(account).where(eq(account.id, accountId));

    return c.json({ data: { deleted: true } }, 200);
  });
}
