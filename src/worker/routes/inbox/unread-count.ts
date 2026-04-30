import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../db/schema";
import { getGmailTokenForMailbox } from "../../lib/gmail/client";
import { getGmailLabel } from "../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../types";

const unreadCountSchema = z.object({
  mailboxId: z.coerce.number().int().positive(),
});

export function registerInboxUnreadCount(api: Hono<AppRouteEnv>) {
  api.get("/unread-count", zValidator("query", unreadCountSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { mailboxId } = c.req.valid("query");

    const mailbox = await db.query.mailboxes.findFirst({
      where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
    });
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    });

    const inbox = await getGmailLabel(accessToken, "INBOX");

    return c.json(
      {
        data: {
          messagesUnread: inbox.messagesUnread ?? 0,
          threadsUnread: inbox.threadsUnread ?? 0,
          syncedAt: Date.now(),
        },
      },
      200,
    );
  });
}
