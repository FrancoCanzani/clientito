import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { mailboxes } from "../../../db/schema";
import {
  ensureGoogleMailboxesForUser,
  getMailboxSyncSnapshot,
  getUserMailboxes,
} from "../../../lib/email/mailbox-state";
import { syncAllMailboxes } from "../../../lib/email/sync";
import type { AppRouteEnv } from "../../types";

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

    await ensureGoogleMailboxesForUser(db, user.id);

    const userMailboxes = await getUserMailboxes(db, user.id);
    const firstMailbox = userMailboxes[0] ?? null;

    const snapshot = firstMailbox
      ? await getMailboxSyncSnapshot(db, firstMailbox.id)
      : { mailbox: null, latestJob: null, activeJob: null, hasLiveLock: false };
    const mailbox = snapshot.mailbox;
    const activeJob = snapshot.activeJob;
    const latestJob = snapshot.latestJob;

    const hasSynced = Boolean(mailbox?.historyId);
    const needsMailboxConnect = userMailboxes.length === 0;

    // Auto-clear stale reconnect_required when Google tokens are valid again
    if (mailbox && mailbox.authState === "reconnect_required") {
      const latestError =
        latestJob?.errorMessage ?? mailbox.lastErrorMessage ?? "";
      if (!latestError) {
        await db
          .update(mailboxes)
          .set({
            authState: "ok",
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedAt: Date.now(),
          })
          .where(eq(mailboxes.id, mailbox.id));
        mailbox.authState = "ok";
      }
    }

    const errorMessage =
      latestJob?.status === "failed"
        ? (latestJob.errorMessage ?? mailbox?.lastErrorMessage ?? null)
        : (mailbox?.lastErrorMessage ?? null);
    const needsGoogleReconnect = mailbox?.authState === "reconnect_required";
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
      syncAllMailboxes(db, c.env, user.id).catch((err) => {
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
