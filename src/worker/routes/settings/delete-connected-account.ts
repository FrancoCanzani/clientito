import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { account } from "../../db/auth-schema";
import { mailboxes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getUser } from "../../middleware/auth";

const deleteConnectedAccountParamsSchema = z.object({
  accountId: z.string().min(1),
});

export function registerDeleteConnectedAccount(api: Hono<AppRouteEnv>) {
  api.delete(
    "/accounts/:accountId",
    zValidator("param", deleteConnectedAccountParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { accountId } = c.req.valid("param");

      const targetAccount = await db.query.account.findFirst({
        where: and(
          eq(account.id, accountId),
          eq(account.userId, user.id),
          eq(account.providerId, "google"),
        ),
      });

      if (!targetAccount) {
        return c.json({ error: "Account not found" }, 404);
      }

      const allGoogleAccounts = await db
        .select({ id: account.id })
        .from(account)
        .where(
          and(eq(account.userId, user.id), eq(account.providerId, "google")),
        );

      if (allGoogleAccounts.length <= 1) {
        return c.json({ error: "Cannot remove last connected account" }, 400);
      }

      await db.delete(mailboxes).where(eq(mailboxes.accountId, accountId));
      await db.delete(account).where(eq(account.id, accountId));

      return c.json({ data: { deleted: true } }, 200);
    },
  );
}
