import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";

const blockSenderSchema = z.object({
  fromAddr: z.string().min(1).max(320),
  mailboxId: z.number().int().positive().optional(),
});

export function registerPostBlockSender(api: Hono<AppRouteEnv>) {
  api.post("/block", zValidator("json", blockSenderSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { fromAddr, mailboxId } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    try {
      const provider = new GmailDriver(db, c.env, mailbox.id);
      const { trashedCount } = await provider.blockSender(fromAddr);
      return c.json({ data: { fromAddr, trashedCount } }, 200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to block sender";
      const isScopeError = /403|insufficient|scope/i.test(message);
      return c.json(
        {
          error: message,
          requiresReconnect: isScopeError,
        },
        isScopeError ? 403 : 502,
      );
    }
  });
}
