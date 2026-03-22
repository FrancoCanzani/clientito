import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import {
  getMailboxSyncPreferences,
  resolveMailbox,
  setMailboxSyncPreferences,
} from "../../lib/email/mailbox-state";
import {
  normalizeSyncWindowMonths,
  requiresBackfillForCutoffChange,
  resolveSyncCutoffAt,
} from "../../lib/email/sync-preferences";
import type { AppRouteEnv } from "../types";

const syncSettingsBodySchema = z.object({
  months: z.union([z.literal(6), z.literal(12), z.null()]),
});

export function registerSyncSettings(settingsRoutes: Hono<AppRouteEnv>) {
  settingsRoutes.get("/sync", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const mailbox = await resolveMailbox(db, user.id);
    if (!mailbox) {
      return c.json({ data: { months: null, cutoffAt: null } });
    }

    const { syncWindowMonths, syncCutoffAt } = await getMailboxSyncPreferences(
      db,
      mailbox.id,
    );

    return c.json({
      data: {
        months: syncWindowMonths,
        cutoffAt: syncCutoffAt,
      },
    });
  });

  settingsRoutes.put(
    "/sync",
    zValidator("json", syncSettingsBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id);
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
          .where(and(eq(emails.userId, user.id), lt(emails.date, nextCutoffAt)));
      }

      return c.json({
        data: {
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
