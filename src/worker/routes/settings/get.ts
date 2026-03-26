import type { Hono } from "hono";
import { hasUsableAccessToken } from "../../lib/email/providers/google/client";
import {
  ensureMailbox,
  ensureGoogleMailboxesForUser,
  getMailboxSyncSnapshot,
  getUserMailboxes,
} from "../../lib/email/mailbox-state";
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

    const userMailboxes = await getUserMailboxes(db, user.id);
    const mailboxByAccountId = new Map(
      userMailboxes
        .filter((mb) => mb.accountId)
        .map((mb) => [mb.accountId!, mb]),
    );

    const accounts = await Promise.all(googleAccounts.map(async (ga) => {
      const mb = mailboxByAccountId.get(ga.id);
      const snapshot = mb ? await getMailboxSyncSnapshot(db, mb.id) : null;
      const mailbox = snapshot?.mailbox ?? mb ?? null;
      const latestJob = snapshot?.latestJob ?? null;
      const activeJob = snapshot?.activeJob ?? null;
      const syncError =
        latestJob?.status === "failed"
          ? (latestJob.errorMessage ?? mailbox?.lastErrorMessage ?? null)
          : (mailbox?.lastErrorMessage ?? null);
      const needsReconnect = mailbox?.authState === "reconnect_required";
      const hasSynced = Boolean(mailbox?.historyId);
      const syncState = needsReconnect
        ? "needs_reconnect"
        : activeJob
          ? "syncing"
          : syncError
            ? "error"
            : hasSynced
              ? "ready"
              : "ready_to_sync";

      return {
        accountId: ga.id,
        mailboxId: mailbox?.id ?? null,
        email: mailbox?.email ?? null,
        signature: mailbox?.signature ?? null,
        authState: mailbox?.authState ?? "unknown",
        lastSync: mailbox?.lastSuccessfulSyncAt ?? null,
        hasSynced,
        hasValidCredentials:
          Boolean(ga.refreshToken) || hasUsableAccessToken(ga),
        syncWindowMonths:
          (mailbox?.syncWindowMonths as 6 | 12 | null | undefined) ?? null,
        syncCutoffAt: mailbox?.syncCutoffAt ?? null,
        syncState,
        phase: activeJob?.phase ?? null,
        progressCurrent: activeJob?.progressCurrent ?? null,
        progressTotal: activeJob?.progressTotal ?? null,
        error: syncError,
        createdAt:
          ga.createdAt instanceof Date
            ? ga.createdAt.getTime()
            : typeof ga.createdAt === "number"
              ? ga.createdAt
              : null,
      };
    }));

    return c.json({ data: { accounts } }, 200);
  });
}
