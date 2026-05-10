import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { account } from "../../../db/auth-schema";
import { mailboxes } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { ensureMailbox } from "../../../lib/gmail/mailboxes";
import {
  normalizeUnsubscribeEmail,
  normalizeUnsubscribeUrl,
} from "../../../lib/gmail/subscriptions/service";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";

const bulkUnsubscribeSchema = z.object({
  items: z
    .array(
      z.object({
        fromAddr: z.string(),
        unsubscribeUrl: z.string().optional(),
        unsubscribeEmail: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

type UnsubscribeResult = {
  fromAddr: string;
  method: string;
  success: boolean;
  url?: string;
};

export function registerPostBulkUnsubscribe(api: Hono<AppRouteEnv>) {
  api.post(
    "/bulk-unsubscribe",
    zValidator("json", bulkUnsubscribeSchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { items } = c.req.valid("json");

      let mailbox: typeof mailboxes.$inferSelect | null = null;
      const userMailboxes = await db
        .select()
        .from(mailboxes)
        .where(eq(mailboxes.userId, user.id));
      mailbox = userMailboxes[0] ?? null;
      if (!mailbox) {
        const googleAccount = await db.query.account.findFirst({
          where: and(
            eq(account.userId, user.id),
            eq(account.providerId, "google"),
          ),
        });
        mailbox =
          (await ensureMailbox(db, user.id, googleAccount?.id ?? null)) ?? null;
      }

      const results: UnsubscribeResult[] = [];

      for (const item of items) {
        const { fromAddr } = item;
        const unsubscribeUrl = normalizeUnsubscribeUrl(item.unsubscribeUrl);
        const unsubscribeEmail = normalizeUnsubscribeEmail(item.unsubscribeEmail);

        if (unsubscribeUrl) {
          try {
            const res = await fetch(unsubscribeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: "List-Unsubscribe=One-Click-Unsubscribe",
            });

            if (res.ok || res.status === 204 || res.status === 302) {
              results.push({ fromAddr, method: "one-click", success: true });
              continue;
            }
          } catch (error) {
            console.warn("One-click unsubscribe failed, falling back", {
              fromAddr,
              url: unsubscribeUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          if (!unsubscribeEmail) {
            results.push({ fromAddr, method: "manual", success: false, url: unsubscribeUrl });
            continue;
          }
        }

        if (unsubscribeEmail) {
          if (!mailbox) {
            results.push({ fromAddr, method: "mailto", success: false });
            continue;
          }

          try {
            const provider = new GmailDriver(db, c.env, mailbox.id);
            await provider.send(mailbox.email ?? user.email, {
              to: unsubscribeEmail,
              subject: "Unsubscribe",
              body: "Unsubscribe",
            });

            results.push({ fromAddr, method: "mailto", success: true });
            continue;
          } catch (error) {
            console.warn("Mailto unsubscribe failed", {
              fromAddr,
              error: error instanceof Error ? error.message : String(error),
            });
            results.push({ fromAddr, method: "mailto", success: false });
            continue;
          }
        }

        results.push({ fromAddr, method: "none", success: false });
      }

      return c.json({ results }, 200);
    },
  );
}
