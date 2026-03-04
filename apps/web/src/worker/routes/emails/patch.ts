import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { emails } from "../../db/schema";
import {
  archiveGmailMessage,
  markGmailMessageRead,
  starGmailMessage,
  trashGmailMessage,
} from "../../lib/gmail/modify";
import type { AppRouteEnv } from "../types";
import { patchEmailBodySchema, patchEmailParamsSchema } from "./schemas";

export function registerPatchEmail(api: Hono<AppRouteEnv>) {
  api.patch(
    "/:emailId",
    zValidator("param", patchEmailParamsSchema),
    zValidator("json", patchEmailBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { emailId } = c.req.valid("param");
      const body = c.req.valid("json");

      const row = await db
        .select({
          id: emails.id,
          gmailId: emails.gmailId,
          isRead: emails.isRead,
          labelIds: emails.labelIds,
        })
        .from(emails)
        .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)))
        .limit(1);

      const email = row[0];
      if (!email) return c.json({ error: "Email not found" }, 404);

      let labelIds = email.labelIds ?? [];
      const dbUpdates: Partial<typeof emails.$inferInsert> = {};

      if (body.isRead !== undefined && body.isRead !== email.isRead) {
        dbUpdates.isRead = body.isRead;
        if (body.isRead) {
          c.executionCtx.waitUntil(
            markGmailMessageRead(db, c.env, user.id, email.gmailId).catch(
              (err) => console.warn("Gmail mark-read failed", { err }),
            ),
          );
        }
      }

      if (body.archived === true && labelIds.includes("INBOX")) {
        labelIds = labelIds.filter((l) => l !== "INBOX");
        dbUpdates.labelIds = labelIds;
        c.executionCtx.waitUntil(
          archiveGmailMessage(db, c.env, user.id, email.gmailId).catch((err) =>
            console.warn("Gmail archive failed", { err }),
          ),
        );
      }

      if (body.trashed === true && !labelIds.includes("TRASH")) {
        labelIds = [...labelIds.filter((l) => l !== "INBOX"), "TRASH"];
        dbUpdates.labelIds = labelIds;
        c.executionCtx.waitUntil(
          trashGmailMessage(db, c.env, user.id, email.gmailId).catch((err) =>
            console.warn("Gmail trash failed", { err }),
          ),
        );
      }

      if (body.starred !== undefined) {
        const isStarred = labelIds.includes("STARRED");
        if (body.starred && !isStarred) {
          labelIds = [...labelIds, "STARRED"];
          dbUpdates.labelIds = labelIds;
        } else if (!body.starred && isStarred) {
          labelIds = labelIds.filter((l) => l !== "STARRED");
          dbUpdates.labelIds = labelIds;
        }
        if (body.starred !== isStarred) {
          c.executionCtx.waitUntil(
            starGmailMessage(
              db,
              c.env,
              user.id,
              email.gmailId,
              body.starred,
            ).catch((err) => console.warn("Gmail star failed", { err })),
          );
        }
      }

      if (Object.keys(dbUpdates).length > 0) {
        await db
          .update(emails)
          .set(dbUpdates)
          .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)));
      }

      return c.json(
        {
          data: {
            id: String(emailId),
            isRead: dbUpdates.isRead ?? email.isRead,
            archived: !labelIds.includes("INBOX"),
            trashed: labelIds.includes("TRASH"),
            starred: labelIds.includes("STARRED"),
          },
        },
        200,
      );
    },
  );
}
