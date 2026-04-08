import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import type { AppRouteEnv } from "../../types";
import { applyEmailPatch } from "./internal/mutation";
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
          providerMessageId: emails.providerMessageId,
          mailboxId: emails.mailboxId,
          isRead: emails.isRead,
          labelIds: emails.labelIds,
          snoozedUntil: emails.snoozedUntil,
        })
        .from(emails)
        .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)))
        .limit(1);

      const email = row[0];
      if (!email || !email.mailboxId) return c.json({ error: "Email not found" }, 404);

      const nextState = applyEmailPatch(email, body);
      const { dbUpdates } = nextState;

      if (
        nextState.addLabelIds.length > 0 ||
        nextState.removeLabelIds.length > 0
      ) {
        try {
          const provider = new GmailDriver(db, c.env, email.mailboxId);
          await provider.modifyLabels(
            [email.providerMessageId],
            nextState.addLabelIds,
            nextState.removeLabelIds,
          );
        } catch (error) {
          console.warn("Provider label modify failed", {
            emailId,
            providerMessageId: email.providerMessageId,
            error,
          });
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update message labels",
            },
            502,
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
            isRead: nextState.isRead,
            archived: nextState.archived,
            trashed: nextState.trashed,
            spam: nextState.spam,
            starred: nextState.starred,
            snoozedUntil: nextState.snoozedUntil,
          },
        },
        200,
      );
    },
  );
}
