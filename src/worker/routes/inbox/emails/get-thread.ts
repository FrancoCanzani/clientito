import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { handleGmailError } from "../../../lib/gmail/errors";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import { fetchThreadsAndParse } from "../../../lib/gmail/sync/threads";
import { getUser } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";

const getThreadSchema = z.object({
  mailboxId: z.number().int().positive(),
  threadId: z.string().min(1).max(120),
});

export function registerGetEmailThread(api: Hono<AppRouteEnv>) {
  api.post("/thread", zValidator("json", getThreadSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId, threadId } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

    try {
      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      const emails = await fetchThreadsAndParse(accessToken, [threadId], null);

      if (mailbox.authState !== "ok" || mailbox.lastErrorMessage) {
        await db
          .update(mailboxes)
          .set({
            authState: "ok",
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedAt: Date.now(),
          })
          .where(eq(mailboxes.id, mailbox.id));
      }

      return c.json({ emails });
    } catch (error) {
      const handled = handleGmailError(error, db, mailbox.id, c);
      if (handled) return handled;
      throw error;
    }
  });
}
