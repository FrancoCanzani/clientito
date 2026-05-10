import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../db/schema";
import { syncMailboxSignatureToGmail } from "../../lib/gmail/mailbox/signature";
import type { AppRouteEnv } from "../types";
import { getUser } from "../../middleware/auth";

const patchMailboxSchema = z.object({
  signature: z.string().max(50_000).optional(),
  templates: z.string().max(200_000).optional(),
  aiEnabled: z.boolean().optional(),
});

export function registerPatchMailbox(api: Hono<AppRouteEnv>) {
  api.patch(
    "/mailboxes/:mailboxId",
    zValidator(
      "param",
      z.object({ mailboxId: z.coerce.number().int().positive() }),
    ),
    zValidator("json", patchMailboxSchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { mailboxId } = c.req.valid("param");
      const { signature, templates, aiEnabled } = c.req.valid("json");

      const existing = await db
        .select({ id: mailboxes.id, email: mailboxes.email })
        .from(mailboxes)
        .where(
          and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
        )
        .limit(1);

      if (!existing[0]) return c.json({ error: "Mailbox not found" }, 404);

      if (signature !== undefined) {
        try {
          await syncMailboxSignatureToGmail(
            db,
            c.env,
            mailboxId,
            existing[0].email,
            signature,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to sync signature with Gmail";
          return c.json({ error: message }, 502);
        }
      }

      await db
        .update(mailboxes)
        .set({
          ...(signature !== undefined ? { signature } : {}),
          ...(templates !== undefined ? { templates } : {}),
          ...(aiEnabled !== undefined ? { aiEnabled } : {}),
          updatedAt: Date.now(),
        })
        .where(
          and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
        );

      return c.json({ data: { updated: true } }, 200);
    },
  );
}