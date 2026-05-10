import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";
import { deleteEmailBodySchema } from "./schemas";

export function registerDeleteEmail(api: Hono<AppRouteEnv>) {
  api.delete(
    "/:emailId",
    zValidator("json", deleteEmailBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { providerMessageId, mailboxId } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      try {
        const provider = new GmailDriver(db, c.env, mailbox.id);
        await provider.hardDelete(providerMessageId);
      } catch (error) {
        console.warn("Provider delete failed", {
          providerMessageId,
          error,
        });
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete message",
          },
          502,
        );
      }

      return c.json({ data: { providerMessageId } }, 200);
    },
  );
}
