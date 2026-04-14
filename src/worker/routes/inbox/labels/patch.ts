import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { updateGmailLabel } from "../../../lib/gmail/mailbox/labels";
import type { AppRouteEnv } from "../../types";

const updateLabelParamsSchema = z.object({
  labelId: z.string().trim().min(1),
});

const updateLabelBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

export function registerUpdateLabel(api: Hono<AppRouteEnv>) {
  api.patch(
    "/:labelId",
    zValidator("param", updateLabelParamsSchema),
    zValidator("json", updateLabelBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { labelId } = c.req.valid("param");
      const { mailboxId, name, textColor, backgroundColor } = c.req.valid("json");

      const mailbox = await db.query.mailboxes.findFirst({
        where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
      });
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      const params: { name?: string; color?: { textColor: string; backgroundColor: string } } = {};
      if (name) params.name = name;
      if (textColor && backgroundColor) {
        params.color = { textColor, backgroundColor };
      }

      const updated = await updateGmailLabel(accessToken, labelId, params);

      return c.json({
        data: {
          gmailId: updated.id,
          name: updated.name,
          type: updated.type?.toLowerCase() ?? "user",
          textColor: updated.color?.textColor ?? null,
          backgroundColor: updated.color?.backgroundColor ?? null,
          messagesTotal: updated.messagesTotal ?? 0,
          messagesUnread: updated.messagesUnread ?? 0,
        },
      }, 200);
    },
  );
}
