import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getUser } from "../../middleware/auth";
import { mailboxes } from "../../db/schema";
import {
  getGmailProfile,
  getGmailTokenForMailbox,
} from "../../lib/gmail/client";
import { handleGmailError } from "../../lib/gmail/errors";
import { refreshMailboxSignaturesIfStale } from "../../lib/gmail/mailbox/signature";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { pullDeltaSync } from "../../lib/gmail/sync/history";
import { markRepliedReminders } from "../../lib/reminders/detect-replies";
import type { AppRouteEnv } from "../types";

const deltaSyncSchema = z.object({
  mailboxId: z.number().int().positive(),
  historyId: z.string().min(1).optional(),
});

const deltaAckSchema = z.object({
  mailboxId: z.number().int().positive(),
  historyId: z.string().min(1),
});

export function registerInboxSyncDelta(api: Hono<AppRouteEnv>) {
  api.post("/sync/delta", zValidator("json", deltaSyncSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId, historyId: clientHistoryId } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

    try {
      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      const markMailboxHealthy = async () => {
        await db
          .update(mailboxes)
          .set({
            authState: "ok",
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedAt: Date.now(),
          })
          .where(eq(mailboxes.id, mailbox.id));
      };

      const refreshSignatures = (force: boolean) => {
        c.executionCtx.waitUntil(
          refreshMailboxSignaturesIfStale(
            db,
            {
              GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
              GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
            },
            {
              id: mailbox.id,
              userId: mailbox.userId,
              signaturesSyncedAt: mailbox.signaturesSyncedAt,
            },
            { force },
          ),
        );
      };

      const startHistoryId = clientHistoryId ?? null;

      if (!startHistoryId) {
        const profile = await getGmailProfile(accessToken);
        const newHistoryId = profile.historyId ?? null;
        await markMailboxHealthy();
        refreshSignatures(true);
        return c.json({
          status: "noop" as const,
          added: [],
          deleted: [],
          labelChanges: [],
          historyId: newHistoryId,
        });
      }

      const result = await pullDeltaSync(accessToken, startHistoryId);

      if (result.status === "stale") {
        const profile = await getGmailProfile(accessToken);
        const newHistoryId = profile.historyId ?? result.newHistoryId ?? null;
        await markMailboxHealthy();
        refreshSignatures(false);
        return c.json({
          status: "stale" as const,
          added: [],
          deleted: [],
          labelChanges: [],
          historyId: newHistoryId,
        });
      }

      if (result.status === "noop") {
        await markMailboxHealthy();
        refreshSignatures(false);
        return c.json({
          status: "noop" as const,
          added: [],
          deleted: [],
          labelChanges: [],
          historyId: result.newHistoryId,
        });
      }

      await markMailboxHealthy();
      refreshSignatures(false);

      if (result.added.length > 0) {
        await markRepliedReminders(
          db,
          c.env,
          user.id,
          mailbox.id,
          result.added.map((message) => ({
            threadId: message.threadId,
            labelIds: message.labelIds,
          })),
        ).catch((error) => {
          console.warn("Reply-reminder detection failed", {
            mailboxId: mailbox.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      return c.json({
        status: "ok" as const,
        added: result.added,
        deleted: result.deleted,
        labelChanges: result.labelChanges,
        historyId: result.newHistoryId,
      });
    } catch (error) {
      const handled = handleGmailError(error, db, mailbox.id, c);
      if (handled) return handled;
      throw error;
    }
  });

  api.post("/sync/delta/ack", zValidator("json", deltaAckSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId, historyId } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

    await db
      .update(mailboxes)
      .set({
        historyId,
        lastSuccessfulSyncAt: Date.now(),
        lastErrorAt: null,
        lastErrorMessage: null,
        authState: "ok",
        updatedAt: Date.now(),
      })
      .where(eq(mailboxes.id, mailbox.id));

    return c.json({ ok: true });
  });
}
