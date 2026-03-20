import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { sendGmailMessage } from "../../lib/gmail/mailbox";
import {
  markEmailSubscriptionStatus,
  normalizeUnsubscribeEmail,
  normalizeUnsubscribeUrl,
} from "../../lib/subscriptions";
import type { AppRouteEnv } from "../types";

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
            return c.json(
              { data: { method: "one-click", fromAddr, success: true } },
              200,
            );
          }
        } catch {
          // one-click failed, fall through to mailto or return the URL for manual
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
            data: {
              method: "manual",
              fromAddr,
              url: unsubscribeUrl,
              success: false,
            },
          },
          200,
        );
      }

      if (unsubscribeEmail) {
        try {
          await sendGmailMessage(db, c.env, user.id, user.email, {
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
          return c.json(
            { data: { method: "mailto", fromAddr, success: true } },
            200,
          );
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
