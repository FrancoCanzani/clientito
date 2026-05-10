import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";

const deleteBatchBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  providerMessageIds: z.array(z.string().trim().min(1)).min(1),
});

export function registerDeleteBatch(api: Hono<AppRouteEnv>) {
  api.post(
    "/batch-delete",
    zValidator("json", deleteBatchBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { mailboxId, providerMessageIds } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      try {
        const provider = new GmailDriver(db, c.env, mailbox.id);
        await provider.hardDeleteBatch(providerMessageIds);
      } catch (error) {
        console.warn("Provider batch delete failed", { error });
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete messages",
          },
          502,
        );
      }

      return c.json({ data: { deletedCount: providerMessageIds.length } }, 200);
    },
  );
}
