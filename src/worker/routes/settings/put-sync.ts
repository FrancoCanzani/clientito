import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import { getMailboxSyncPreferences, setMailboxSyncPreferences } from "../../lib/gmail/sync/state";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import {
  normalizeSyncWindowMonths,
  requiresBackfillForCutoffChange,
  resolveSyncCutoffAt,
} from "../../lib/gmail/sync/preferences";
import type { AppRouteEnv } from "../types";

const syncSettingsBodySchema = z.object({
  mailboxId: z.number().int().positive().optional(),
  months: z.union([z.literal(6), z.literal(12), z.null()]),
});

export function registerPutSyncSettings(settingsRoutes: Hono<AppRouteEnv>) {
  settingsRoutes.put(
    "/sync",
    zValidator("json", syncSettingsBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, body.mailboxId);
      if (!mailbox) {
        return c.json({ error: "No mailbox found" }, 400);
      }

      const previous = await getMailboxSyncPreferences(db, mailbox.id);
      const nextMonths = normalizeSyncWindowMonths(body.months);
      const nextCutoffAt = resolveSyncCutoffAt(nextMonths);

      await setMailboxSyncPreferences(db, mailbox.id, {
        syncWindowMonths: nextMonths,
        syncCutoffAt: nextCutoffAt,
      });

      if (typeof nextCutoffAt === "number") {
        await db
          .delete(emails)
          .where(
            and(
              eq(emails.userId, user.id),
              eq(emails.mailboxId, mailbox.id),
              lt(emails.date, nextCutoffAt),
            ),
          );
      }

      return c.json({
        data: {
          mailboxId: mailbox.id,
          months: nextMonths,
          cutoffAt: nextCutoffAt,
          requiresBackfill: requiresBackfillForCutoffChange(
            previous.syncCutoffAt,
            nextCutoffAt,
          ),
        },
      });
    },
  );
}
