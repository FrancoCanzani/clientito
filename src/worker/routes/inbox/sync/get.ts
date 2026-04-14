import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { mailboxes } from "../../../db/schema";
import { getMailboxSyncSnapshot } from "../../../lib/gmail/sync/state";
import { ensureGoogleMailboxesForUser } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";

type SyncWorkflowState =
  | "needs_mailbox_connect"
  | "needs_reconnect"
  | "ready_to_sync"
  | "error"
  | "ready";

export function registerGetSync(api: Hono<AppRouteEnv>) {
  api.get("/status", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    await ensureGoogleMailboxesForUser(db, user.id);

    const userMailboxes = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.userId, user.id));
    const firstMailbox = userMailboxes[0] ?? null;

    const snapshot = firstMailbox
      ? await getMailboxSyncSnapshot(db, firstMailbox.id)
      : { mailbox: null, latestJob: null, activeJob: null, hasLiveLock: false };
    const mailbox = snapshot.mailbox;
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

    // Browser drives sync via POST /api/inbox/sync/pull — no server-side sync needed.
    const workflowState: SyncWorkflowState = needsMailboxConnect
      ? "needs_mailbox_connect"
      : needsGoogleReconnect
        ? "needs_reconnect"
        : hasSynced
          ? "ready"
          : hasSyncError
            ? "error"
            : "ready_to_sync";

    return c.json(
      {
        state: workflowState,
        hasSynced,
        historyId: mailbox?.historyId ?? null,
        lastSync: mailbox?.lastSuccessfulSyncAt ?? null,
        phase: null,
        progressCurrent: null,
        progressTotal: null,
        error: errorMessage,
        needsMailboxConnect,
        needsGoogleReconnect,
      },
      200,
    );
  });
}
