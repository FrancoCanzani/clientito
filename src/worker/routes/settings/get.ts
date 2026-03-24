import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import { hasUsableAccessToken } from "../../lib/email/providers/google/client";
import {
  ensureMailbox,
  getMailboxSyncSnapshot,
  getUserMailboxes,
} from "../../lib/email/mailbox-state";
import type { AppRouteEnv } from "../types";
import { resolveGmailEmail } from "./utils";

function toTimestamp(value: Date | number | null | undefined): number | null {
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : null;
}

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
        createdAt: account.createdAt,
      })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "google")));

    const seen = new Map<string, (typeof allGoogleAccounts)[number]>();
    for (const ga of allGoogleAccounts) {
      const existing = seen.get(ga.accountId);
      const isNewer =
        toTimestamp(ga.createdAt) !== null &&
        toTimestamp(existing?.createdAt) !== null &&
        toTimestamp(ga.createdAt)! > toTimestamp(existing?.createdAt)!;

      if (!existing || (ga.refreshToken && !existing.refreshToken) || isNewer) {
        seen.set(ga.accountId, ga);
      }
    }
    const googleAccounts = [...seen.values()].sort(
      (a, b) => (toTimestamp(b.createdAt) ?? 0) - (toTimestamp(a.createdAt) ?? 0),
    );

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
        createdAt: toTimestamp(ga.createdAt),
      };
    }));

    return c.json({ data: { accounts } }, 200);
  });
}
