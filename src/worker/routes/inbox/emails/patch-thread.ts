import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import { applyEmailPatch } from "./internal/mutation";
import type { AppRouteEnv } from "../../types";
import { patchThreadBodySchema } from "./schemas";

export function registerPatchThread(api: Hono<AppRouteEnv>) {
  api.patch(
    "/threads/:threadId",
    zValidator("json", patchThreadBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const threadId = c.req.param("threadId")?.trim();
      const { mailboxId, labelIds: currentLabelIds, ...mutation } = c.req.valid("json");

      if (!threadId) return c.json({ error: "Thread not found" }, 400);

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      const currentLabels = currentLabelIds ?? [];
      const source = {
        isRead: !currentLabels.includes("UNREAD"),
        labelIds: currentLabels,
        snoozedUntil: mutation.snoozedUntil ?? null,
      };
      const nextState = applyEmailPatch(source, mutation);

      if (
        nextState.addLabelIds.length > 0 ||
        nextState.removeLabelIds.length > 0
      ) {
        try {
          const provider = new GmailDriver(db, c.env, mailbox.id);
          await provider.modifyThreadLabels(
            threadId,
            nextState.addLabelIds,
            nextState.removeLabelIds,
          );
        } catch (error) {
          console.warn("Provider thread label modify failed", { threadId, error });
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update thread labels",
            },
            502,
          );
        }
      }

      return c.json(
        {
          data: {
            threadId,
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
