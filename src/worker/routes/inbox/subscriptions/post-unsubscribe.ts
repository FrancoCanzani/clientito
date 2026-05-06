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

      const resolveMailbox = async () => {
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
        return mailbox ?? null;
      };

      const archiveExisting = async (): Promise<number> => {
        try {
          const mailbox = await resolveMailbox();
          if (!mailbox) return 0;
          const provider = new GmailDriver(db, c.env, mailbox.id);
          const { archivedCount } = await provider.archiveSender(fromAddr);
          return archivedCount;
        } catch (error) {
          console.warn("Archiving sender after unsubscribe failed", {
            fromAddr,
            error: error instanceof Error ? error.message : String(error),
          });
          return 0;
        }
      };

      if (unsubscribeUrl) {
        try {
          const res = await fetch(unsubscribeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "List-Unsubscribe=One-Click-Unsubscribe",
          });

          if (res.ok || res.status === 204 || res.status === 302) {
            const archivedCount = await archiveExisting();
            return c.json(
              { method: "one-click", fromAddr, success: true, archivedCount },
              200,
            );
          }
        } catch (error) {
          console.warn("One-click unsubscribe failed, falling back", {
            fromAddr,
            url: unsubscribeUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return c.json(
          { method: "manual", fromAddr, url: unsubscribeUrl, success: false },
          200,
        );
      }

      if (unsubscribeEmail) {
        try {
          const mailbox = await resolveMailbox();
          if (!mailbox) {
            return c.json({ error: "No mailbox configured" }, 400);
          }

          const provider = new GmailDriver(db, c.env, mailbox.id);
          await provider.send(mailbox.email ?? user.email, {
            to: unsubscribeEmail,
            subject: "Unsubscribe",
            body: "Unsubscribe",
          });

          const archivedCount = await archiveExisting();
          return c.json(
            { method: "mailto", fromAddr, success: true, archivedCount },
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
