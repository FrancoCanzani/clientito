import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { listGmailLabels } from "../../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";

const getLabelsSchema = z.object({
  mailboxId: z.coerce.number().int().positive(),
});

export function registerGetLabels(api: Hono<AppRouteEnv>) {
  api.get("/", zValidator("query", getLabelsSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId } = c.req.valid("query");

    const mailbox = await db.query.mailboxes.findFirst({
      where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
    });
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    });

    const gmailLabels = await listGmailLabels(accessToken);
    const data = gmailLabels
      .filter((label) => label.type === "user")
      .map((label) => ({
      gmailId: label.id,
      name: label.name,
      type: label.type?.toLowerCase() ?? "user",
      textColor: label.color?.textColor ?? null,
      backgroundColor: label.color?.backgroundColor ?? null,
      messagesTotal: label.messagesTotal ?? 0,
      messagesUnread: label.messagesUnread ?? 0,
    }));

    return c.json({ data }, 200);
  });
}
