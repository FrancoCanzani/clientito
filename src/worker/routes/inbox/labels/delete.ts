import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { labels, mailboxes } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { deleteGmailLabel } from "../../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../../types";

const deleteLabelParamsSchema = z.object({
  labelId: z.string().trim().min(1),
});

const deleteLabelQuerySchema = z.object({
  mailboxId: z.coerce.number().int().positive(),
});

export function registerDeleteLabel(api: Hono<AppRouteEnv>) {
  api.delete(
    "/:labelId",
    zValidator("param", deleteLabelParamsSchema),
    zValidator("query", deleteLabelQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const env = c.env;
      const { labelId } = c.req.valid("param");
      const { mailboxId } = c.req.valid("query");

      const mailbox = await db.query.mailboxes.findFirst({
        where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
      });
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
        GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      });

      await deleteGmailLabel(accessToken, labelId);

      await db
        .delete(labels)
        .where(
          and(eq(labels.mailboxId, mailboxId), eq(labels.gmailId, labelId)),
        );

      return c.json({ success: true }, 200);
    },
  );
}
