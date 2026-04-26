import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { hasUsableAccessToken } from "../../lib/gmail/client";
import { ensureMailbox, ensureGoogleMailboxesForUser } from "../../lib/gmail/mailboxes";
import { mailboxes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { resolveGmailEmail } from "./utils";

export function registerGetSettings(api: Hono<AppRouteEnv>) {
  api.get("/accounts", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const googleAccounts = await ensureGoogleMailboxesForUser(db, user.id);

    for (const ga of googleAccounts) {
      const mb = await ensureMailbox(db, user.id, ga.id);
      if (mb && !mb.email && (ga.refreshToken || hasUsableAccessToken(ga))) {
        const email = await resolveGmailEmail(db, ga.id, c.env);
        if (email) {
          await ensureMailbox(db, user.id, ga.id, email);
        }
      }
    }

    const userMailboxes = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.userId, user.id));
    const mailboxByAccountId = new Map(
      userMailboxes
        .filter((mb) => mb.accountId)
        .map((mb) => [mb.accountId!, mb]),
    );

    const accounts = googleAccounts.map((ga) => {
      const mailbox = mailboxByAccountId.get(ga.id) ?? null;
      const needsReconnect = mailbox?.authState === "reconnect_required";
      const hasSynced = Boolean(mailbox?.historyId);
      const syncState = needsReconnect
        ? "needs_reconnect"
        : mailbox?.lastErrorMessage
          ? "error"
          : hasSynced
            ? "ready"
            : "ready_to_sync";

      return {
        accountId: ga.id,
        mailboxId: mailbox?.id ?? null,
        email: mailbox?.email ?? null,
        signature: mailbox?.signature ?? null,
        templates: mailbox?.templates ?? null,
        authState: mailbox?.authState ?? "unknown",
        lastSync: mailbox?.lastSuccessfulSyncAt ?? null,
        hasSynced,
        hasValidCredentials:
          Boolean(ga.refreshToken) || hasUsableAccessToken(ga),
        syncWindowMonths:
          (mailbox?.syncWindowMonths as 3 | 6 | 12 | null | undefined) ?? null,
        syncCutoffAt: mailbox?.syncCutoffAt ?? null,
        aiEnabled: mailbox?.aiEnabled ?? true,
        syncState,
        error: mailbox?.lastErrorMessage ?? null,
        createdAt:
          ga.createdAt instanceof Date
            ? ga.createdAt.getTime()
            : typeof ga.createdAt === "number"
              ? ga.createdAt
              : null,
      };
    });

    return c.json({ data: { accounts } }, 200);
  });
}
