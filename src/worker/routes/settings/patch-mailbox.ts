import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { mailboxes } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const patchMailboxSchema = z.object({
  signature: z.string().max(2000).optional(),
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
      const user = c.get("user")!;
      const { mailboxId } = c.req.valid("param");
      const { signature } = c.req.valid("json");

      const existing = await db
        .select({ id: mailboxes.id })
        .from(mailboxes)
        .where(
          and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
        )
        .limit(1);

      if (!existing[0]) return c.json({ error: "Mailbox not found" }, 404);

      await db
        .update(mailboxes)
        .set({
          ...(signature !== undefined ? { signature } : {}),
          updatedAt: Date.now(),
        })
        .where(
          and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, user.id)),
        );

      return c.json({ data: { updated: true } }, 200);
    },
  );
}
