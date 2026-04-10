import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { account } from "../../../db/auth-schema";
import { mailboxes } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { ensureMailbox } from "../../../lib/gmail/mailboxes";
import {
  markEmailSubscriptionStatus,
  normalizeUnsubscribeEmail,
  normalizeUnsubscribeUrl,
} from "../../../lib/gmail/subscriptions/service";
import type { AppRouteEnv } from "../../types";

const unsubscribeSchema = z.object({
  unsubscribeUrl: z.string().optional(),
  unsubscribeEmail: z.string().optional(),
  fromAddr: z.string(),
});

export function registerPostUnsubscribe(api: Hono<AppRouteEnv>) {
  api.post(
    "/unsubscribe",
    zValidator("json", unsubscribeSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { unsubscribeUrl: rawUnsubscribeUrl, unsubscribeEmail: rawUnsubscribeEmail, fromAddr } =
        c.req.valid("json");
      const unsubscribeUrl = normalizeUnsubscribeUrl(rawUnsubscribeUrl);
      const unsubscribeEmail = normalizeUnsubscribeEmail(rawUnsubscribeEmail);

      if (unsubscribeUrl) {
        try {
          const res = await fetch(unsubscribeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "List-Unsubscribe=One-Click-Unsubscribe",
          });

          if (res.ok || res.status === 204 || res.status === 302) {
            await markEmailSubscriptionStatus(db, user.id, {
              fromAddr,
              unsubscribeUrl,
              unsubscribeEmail,
              status: "unsubscribed",
              method: "one-click",
            });
            return c.json({ method: "one-click", fromAddr, success: true }, 200);
          }
        } catch (error) {
          console.warn("One-click unsubscribe failed, falling back", {
            fromAddr,
            url: unsubscribeUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await markEmailSubscriptionStatus(db, user.id, {
          fromAddr,
          unsubscribeUrl,
          unsubscribeEmail,
          status: "pending_manual",
          method: "manual",
        });
        return c.json(
          {
            method: "manual",
            fromAddr,
            url: unsubscribeUrl,
            success: false,
          },
          200,
        );
      }

      if (unsubscribeEmail) {
        try {
          // Resolve mailbox for sending
          const userMailboxes = await db
            .select()
            .from(mailboxes)
            .where(eq(mailboxes.userId, user.id));
          let mailbox = userMailboxes[0];
          if (!mailbox) {
            const googleAccount = await db.query.account.findFirst({
              where: and(eq(account.userId, user.id), eq(account.providerId, "google")),
            });
            mailbox = (await ensureMailbox(db, user.id, googleAccount?.id ?? null))!;
          }
          if (!mailbox) {
            return c.json({ error: "No mailbox configured" }, 400);
          }

          const provider = new GmailDriver(db, c.env, mailbox.id);
          await provider.send(mailbox.email ?? user.email, {
            to: unsubscribeEmail,
            subject: "Unsubscribe",
            body: "Unsubscribe",
          });

          await markEmailSubscriptionStatus(db, user.id, {
            fromAddr,
            unsubscribeUrl,
            unsubscribeEmail,
            status: "unsubscribed",
            method: "mailto",
          });
          return c.json({ method: "mailto", fromAddr, success: true }, 200);
        } catch (error) {
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to send unsubscribe email",
            },
            500,
          );
        }
      }

      return c.json({ error: "No unsubscribe method provided" }, 400);
    },
  );
}
