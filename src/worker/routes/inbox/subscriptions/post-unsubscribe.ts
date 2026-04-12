import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { account } from "../../../db/auth-schema";
import type { Database } from "../../../db/client";
import { emails, mailboxes } from "../../../db/schema";
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
  trashExisting: z.boolean().optional(),
});

export async function trashEmailsFromSender(
  db: Database,
  userId: string,
  fromAddr: string,
): Promise<number> {
  const senderLower = fromAddr.trim().toLowerCase();

  const rows = await db
    .select({ id: emails.id, labelIds: emails.labelIds })
    .from(emails)
    .where(
      and(
        eq(emails.userId, userId),
        sql`lower(${emails.fromAddr}) = ${senderLower}`,
      ),
    );

  let count = 0;
  for (const row of rows) {
    const current: string[] = Array.isArray(row.labelIds) ? row.labelIds : [];
    if (current.includes("TRASH")) continue;
    const updated = current.filter((l) => l !== "INBOX");
    updated.push("TRASH");
    await db
      .update(emails)
      .set({ labelIds: updated })
      .where(eq(emails.id, row.id));
    count++;
  }
  return count;
}

export function registerPostUnsubscribe(api: Hono<AppRouteEnv>) {
  api.post(
    "/unsubscribe",
    zValidator("json", unsubscribeSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { unsubscribeUrl: rawUnsubscribeUrl, unsubscribeEmail: rawUnsubscribeEmail, fromAddr, trashExisting } =
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
            let trashedCount = 0;
            if (trashExisting) {
              trashedCount = await trashEmailsFromSender(db, user.id, fromAddr);
            }
            return c.json({ method: "one-click", fromAddr, success: true, trashedCount }, 200);
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
          let trashedCount = 0;
          if (trashExisting) {
            trashedCount = await trashEmailsFromSender(db, user.id, fromAddr);
          }
          return c.json({ method: "mailto", fromAddr, success: true, trashedCount }, 200);
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
