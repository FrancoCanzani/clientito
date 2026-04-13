import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { labels, mailboxes } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { createGmailLabel } from "../../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../../types";

const createLabelSchema = z.object({
  mailboxId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

export function registerCreateLabel(api: Hono<AppRouteEnv>) {
  api.post("/", zValidator("json", createLabelSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;
    const { mailboxId, name, textColor, backgroundColor } = c.req.valid("json");

    const mailbox = await db.query.mailboxes.findFirst({
      where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
    });
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    const color =
      textColor && backgroundColor
        ? { textColor, backgroundColor }
        : undefined;

    const gmailLabel = await createGmailLabel(accessToken, { name, color });
    const now = Date.now();

    await db.insert(labels).values({
      gmailId: gmailLabel.id,
      userId: user.id,
      mailboxId,
      name: gmailLabel.name,
      type: "user",
      textColor: gmailLabel.color?.textColor ?? null,
      backgroundColor: gmailLabel.color?.backgroundColor ?? null,
      messagesTotal: 0,
      messagesUnread: 0,
      syncedAt: now,
    });

    const inserted = await db.query.labels.findFirst({
      where: and(eq(labels.mailboxId, mailboxId), eq(labels.gmailId, gmailLabel.id)),
    });

    return c.json({ data: inserted }, 201);
  });
}
