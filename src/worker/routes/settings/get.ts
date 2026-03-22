import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import { hasUsableAccessToken } from "../../lib/email/providers/google/client";
import { ensureMailbox, getUserMailboxes } from "../../lib/email/mailbox-state";
import type { AppRouteEnv } from "../types";
import { resolveGmailEmail } from "./utils";

export function registerGetSettings(api: Hono<AppRouteEnv>) {
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
      if (mb && !mb.email && (ga.refreshToken || hasUsableAccessToken(ga))) {
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
        email: mb?.email ?? null,
        authState: mb?.authState ?? "unknown",
        lastSync: mb?.lastSuccessfulSyncAt ?? null,
        hasSynced: Boolean(mb?.historyId),
        hasValidCredentials:
          Boolean(ga.refreshToken) || hasUsableAccessToken(ga),
      };
    });

    return c.json({ data: { accounts } }, 200);
  });
}
