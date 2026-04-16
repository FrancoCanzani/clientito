import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import { applyEmailPatch } from "./internal/mutation";
import type { AppRouteEnv } from "../../types";
import { batchPatchEmailsBodySchema } from "./schemas";

type LabelMutationGroup = {
  mailboxId: number;
  providerMessageIds: string[];
  addLabelIds: string[];
  removeLabelIds: string[];
};

function createMutationGroupKey(
  addLabelIds: string[],
  removeLabelIds: string[],
) {
  return JSON.stringify({
    addLabelIds: [...addLabelIds].sort(),
    removeLabelIds: [...removeLabelIds].sort(),
  });
}

export function registerBatchPatchEmails(api: Hono<AppRouteEnv>) {
  api.post(
    "/batch",
    zValidator("json", batchPatchEmailsBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const { items, ...mutation } = body;

      // Validate all mailboxes belong to this user
      const mailboxIds = [...new Set(items.map((i) => i.mailboxId))];
      const resolvedMailboxes = await Promise.all(
        mailboxIds.map(async (mbId) => {
          const mb = await resolveMailbox(db, user.id, mbId);
          return { id: mbId, resolved: mb };
        }),
      );
      const validMailboxIds = new Set(
        resolvedMailboxes.filter((m) => m.resolved).map((m) => m.id),
      );

      const results: Array<{
        providerMessageId: string;
        isRead: boolean;
        archived: boolean;
        trashed: boolean;
        spam: boolean;
        starred: boolean;
        snoozedUntil: number | null;
      }> = [];

      const labelMutationGroups = new Map<string, LabelMutationGroup>();

      for (const item of items) {
        if (!validMailboxIds.has(item.mailboxId)) continue;

        const itemLabels = item.labelIds ?? [];
        const source = {
          isRead: !itemLabels.includes("UNREAD"),
          labelIds: itemLabels,
          snoozedUntil: mutation.snoozedUntil ?? null,
        };

        const state = applyEmailPatch(source, mutation);

        results.push({
          providerMessageId: item.providerMessageId,
          isRead: state.isRead,
          archived: state.archived,
          trashed: state.trashed,
          spam: state.spam,
          starred: state.starred,
          snoozedUntil: state.snoozedUntil,
        });

        if (state.addLabelIds.length > 0 || state.removeLabelIds.length > 0) {
          const key = `${item.mailboxId}:${createMutationGroupKey(
            state.addLabelIds,
            state.removeLabelIds,
          )}`;
          const group = labelMutationGroups.get(key);

          if (group) {
            group.providerMessageIds.push(item.providerMessageId);
          } else {
            labelMutationGroups.set(key, {
              mailboxId: item.mailboxId,
              providerMessageIds: [item.providerMessageId],
              addLabelIds: state.addLabelIds,
              removeLabelIds: state.removeLabelIds,
            });
          }
        }
      }

      for (const group of labelMutationGroups.values()) {
        try {
          const provider = new GmailDriver(db, c.env, group.mailboxId);
          await provider.modifyLabels(
            group.providerMessageIds,
            group.addLabelIds,
            group.removeLabelIds,
          );
        } catch (error) {
          console.warn("Provider batch label modify failed", {
            error,
            providerMessageIds: group.providerMessageIds,
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

      return c.json({ data: results }, 200);
    },
  );
}
