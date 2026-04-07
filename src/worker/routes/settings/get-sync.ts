import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getMailboxSyncPreferences,
  resolveMailbox,
} from "../../lib/email/mailbox-state";
import type { AppRouteEnv } from "../types";

const syncSettingsQuerySchema = z.object({
  mailboxId: z.coerce.number().int().positive().optional(),
});

export function registerGetSyncSettings(settingsRoutes: Hono<AppRouteEnv>) {
  settingsRoutes.get(
    "/sync",
    zValidator("query", syncSettingsQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId } = c.req.valid("query");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) {
        return c.json({ data: { mailboxId: null, months: null, cutoffAt: null } });
      }

      const { syncWindowMonths, syncCutoffAt } = await getMailboxSyncPreferences(
        db,
        mailbox.id,
      );

      return c.json({
        data: {
          mailboxId: mailbox.id,
          months: syncWindowMonths,
          cutoffAt: syncCutoffAt,
        },
      });
    },
  );
}
