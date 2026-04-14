import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import { applyEmailPatch } from "./internal/mutation";
import type { AppRouteEnv } from "../../types";
import { patchEmailBodySchema } from "./schemas";

export function registerPatchEmail(api: Hono<AppRouteEnv>) {
  api.patch(
    "/:emailId",
    zValidator("json", patchEmailBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const { providerMessageId, mailboxId, labelIds: currentLabelIds, ...mutation } = body;

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      const source = {
        isRead: mutation.isRead ?? true,
        labelIds: currentLabelIds ?? [],
        snoozedUntil: mutation.snoozedUntil ?? null,
      };

      const nextState = applyEmailPatch(source, mutation);

      if (
        nextState.addLabelIds.length > 0 ||
        nextState.removeLabelIds.length > 0
      ) {
        try {
          const provider = new GmailDriver(db, c.env, mailbox.id);
          await provider.modifyLabels(
            [providerMessageId],
            nextState.addLabelIds,
            nextState.removeLabelIds,
          );
        } catch (error) {
          console.warn("Provider label modify failed", {
            providerMessageId,
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

      return c.json(
        {
          data: {
            providerMessageId,
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
