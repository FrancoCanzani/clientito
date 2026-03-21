import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import { mailboxes } from "../../db/schema";
import { hasUsableAccessToken } from "../../lib/gmail/client";
import { GOOGLE_RECONNECT_REQUIRED_MESSAGE } from "../../lib/gmail/errors";
import {
  getMailboxSyncSnapshot,
  getUserMailboxes,
} from "../../lib/gmail/mailbox-state";
import { catchUpAllMailboxes } from "../../lib/gmail/sync";
import type { AppRouteEnv } from "../types";

const GOOGLE_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

function hasScope(scope: string | null | undefined, target: string): boolean {
  if (!scope) return false;

  return scope
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(target);
}

type SyncWorkflowState =
  | "needs_mailbox_connect"
  | "needs_reconnect"
  | "ready_to_sync"
  | "error"
  | "syncing"
  | "ready";

export function registerGetSync(api: Hono<AppRouteEnv>) {
  api.get("/status", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    // Get all mailboxes for user; use the first one for the legacy single-account status
    const userMailboxes = await getUserMailboxes(db, user.id);
    const firstMailbox = userMailboxes[0] ?? null;

    const snapshot = firstMailbox
      ? await getMailboxSyncSnapshot(db, firstMailbox.id)
      : { mailbox: null, latestJob: null, activeJob: null, hasLiveLock: false };
    const mailbox = snapshot.mailbox;
    const activeJob = snapshot.activeJob;
    const latestJob = snapshot.latestJob;

    const googleAccount = await db.query.account.findFirst({
      where: and(eq(account.userId, user.id), eq(account.providerId, "google")),
      columns: {
        accessToken: true,
        accessTokenExpiresAt: true,
        refreshToken: true,
        scope: true,
      },
    });

    const hasSynced = Boolean(mailbox?.historyId);
    const hasRequiredGmailScopes =
      googleAccount !== undefined &&
      GOOGLE_GMAIL_SCOPES.every((scope) => hasScope(googleAccount.scope, scope));
    const hasValidCredentials =
      hasRequiredGmailScopes &&
      (Boolean(googleAccount.refreshToken) || hasUsableAccessToken(googleAccount));
    const googleNeedsReconnect =
      googleAccount !== undefined &&
      hasRequiredGmailScopes &&
      !googleAccount.refreshToken &&
      !hasUsableAccessToken(googleAccount);
    const needsMailboxConnect =
      googleAccount === undefined || !hasRequiredGmailScopes;

    // Auto-clear stale reconnect_required when Google tokens are valid again
    if (
      mailbox &&
      mailbox.authState === "reconnect_required" &&
      hasValidCredentials
    ) {
      await db
        .update(mailboxes)
        .set({ authState: "ok", lastErrorAt: null, lastErrorMessage: null, updatedAt: Date.now() })
        .where(eq(mailboxes.id, mailbox.id));
      mailbox.authState = "ok";
    }

    const errorMessage =
      latestJob?.status === "failed"
        ? (latestJob.errorMessage ?? mailbox?.lastErrorMessage ?? null)
        : (mailbox?.lastErrorMessage ?? null);
    const needsGoogleReconnect =
      googleNeedsReconnect ||
      mailbox?.authState === "reconnect_required" ||
      errorMessage === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
    const hasSyncError =
      Boolean(errorMessage) && !needsMailboxConnect && !needsGoogleReconnect;

    const workflowState: SyncWorkflowState = needsMailboxConnect
      ? "needs_mailbox_connect"
      : needsGoogleReconnect
        ? "needs_reconnect"
        : activeJob
          ? "syncing"
          : hasSynced
            ? "ready"
            : hasSyncError
              ? "error"
              : "ready_to_sync";

    // Trigger catch-up for all mailboxes
    c.executionCtx.waitUntil(
      catchUpAllMailboxes(db, c.env, user.id).catch((err) => {
        console.error("Background catch-up failed", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    );

    return c.json(
      {
        data: {
          state: workflowState,
          hasSynced,
          historyId: mailbox?.historyId ?? null,
          lastSync: mailbox?.lastSuccessfulSyncAt ?? null,
          phase: activeJob?.phase ?? null,
          progressCurrent: activeJob?.progressCurrent ?? null,
          progressTotal: activeJob?.progressTotal ?? null,
          error: errorMessage,
          needsMailboxConnect,
          needsGoogleReconnect,
        },
      },
      200,
    );
  });
}
