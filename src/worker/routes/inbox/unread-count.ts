import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../db/schema";
import { getGmailTokenForMailbox } from "../../lib/gmail/client";
import {
  countMessagesWithLabels,
  getGmailLabel,
} from "../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../types";
import { getUser } from "../../middleware/auth";

const unreadCountSchema = z.object({
  mailboxId: z.coerce.number().int().positive(),
});

function labelUnreadCount(label: {
  messagesUnread?: number;
  threadsUnread?: number;
}) {
  return {
    messagesUnread: label.messagesUnread ?? 0,
    threadsUnread: label.threadsUnread ?? 0,
    syncedAt: Date.now(),
  };
}

export function registerInboxUnreadCount(api: Hono<AppRouteEnv>) {
  api.get("/unread-count", zValidator("query", unreadCountSchema), async (c) => {
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

    const inbox = await getGmailLabel(accessToken, "INBOX");

    return c.json(
      {
        data: labelUnreadCount(inbox),
      },
      200,
    );
  });

  api.get("/view-counts", zValidator("query", unreadCountSchema), async (c) => {
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

    const [inbox, importantUnreadInInbox] = await Promise.all([
      getGmailLabel(accessToken, "INBOX"),
      countMessagesWithLabels(accessToken, ["IMPORTANT", "INBOX", "UNREAD"]).catch(
        () => 0,
      ),
    ]);

    return c.json(
      {
        data: {
          inbox: labelUnreadCount(inbox),
          important: {
            messagesUnread: importantUnreadInInbox,
            threadsUnread: importantUnreadInInbox,
            syncedAt: Date.now(),
          },
        },
      },
      200,
    );
  });
}
