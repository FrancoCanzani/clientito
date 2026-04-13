import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../../db/schema";
import { syncGmailLabels } from "../../../lib/gmail/sync/labels";
import type { AppRouteEnv } from "../../types";

const syncLabelsSchema = z.object({
  mailboxId: z.coerce.number().int().positive(),
});

export function registerSyncLabels(api: Hono<AppRouteEnv>) {
  api.post("/sync", zValidator("json", syncLabelsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;
    const { mailboxId } = c.req.valid("json");

    const mailbox = await db.query.mailboxes.findFirst({
      where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
    });
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    await syncGmailLabels(db, mailboxId, user.id, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    return c.json({ success: true }, 200);
  });
}
