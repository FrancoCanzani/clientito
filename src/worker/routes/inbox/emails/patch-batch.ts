import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import type { Database } from "../../../db/client";
import { emails } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { chunkArray } from "../../../lib/utils";
import type { AppRouteEnv } from "../../types";
import { applyEmailPatch } from "./internal/mutation";
import { batchPatchEmailsBodySchema } from "./schemas";

type LabelMutationGroup = {
  mailboxId: number;
  providerMessageIds: string[];
  addLabelIds: string[];
  removeLabelIds: string[];
  rows: Array<{
    id: number;
    state: ReturnType<typeof applyEmailPatch>;
  }>;
};

const D1_BATCH_QUERY_CHUNK_SIZE = 90;

function createMutationGroupKey(
  addLabelIds: string[],
  removeLabelIds: string[],
) {
  return JSON.stringify({
    addLabelIds: [...addLabelIds].sort(),
    removeLabelIds: [...removeLabelIds].sort(),
  });
}

async function applyDbUpdates(
  db: Database,
  userId: string,
  rows: Array<{
    id: number;
    state: ReturnType<typeof applyEmailPatch>;
  }>,
) {
  const updates = rows.filter(
    ({ state }) => Object.keys(state.dbUpdates).length > 0,
  );

  if (updates.length === 0) {
    return;
  }

  const grouped = new Map<string, number[]>();
  for (const { id, state } of updates) {
    const key = JSON.stringify(state.dbUpdates);
    const ids = grouped.get(key);
    if (ids) ids.push(id);
    else grouped.set(key, [id]);
  }

  await Promise.all(
    Array.from(grouped.entries()).map(([key, ids]) =>
      db
        .update(emails)
        .set(JSON.parse(key))
        .where(and(eq(emails.userId, userId), inArray(emails.id, ids))),
    ),
  );
}

export function registerBatchPatchEmails(api: Hono<AppRouteEnv>) {
  api.post(
    "/batch",
    zValidator("json", batchPatchEmailsBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const emailIdChunks = chunkArray(
        body.emailIds,
        D1_BATCH_QUERY_CHUNK_SIZE,
      );
      const rowChunks = await Promise.all(
        emailIdChunks.map((emailIds) =>
          db
            .select({
              id: emails.id,
              providerMessageId: emails.providerMessageId,
              mailboxId: emails.mailboxId,
              isRead: emails.isRead,
              labelIds: emails.labelIds,
              snoozedUntil: emails.snoozedUntil,
            })
            .from(emails)
            .where(
              and(eq(emails.userId, user.id), inArray(emails.id, emailIds)),
            ),
        ),
      );
      const rows = rowChunks.flat();

      if (rows.length === 0) {
        return c.json({ error: "Emails not found" }, 404);
      }

      const labelMutationGroups = new Map<string, LabelMutationGroup>();
      const localOnlyRows: Array<{
        id: number;
        state: ReturnType<typeof applyEmailPatch>;
      }> = [];

      const nextRows = rows.map((email) => {
        const state = applyEmailPatch(email, body);
        const nextRow = {
          id: email.id,
          state,
        };

        if (
          (state.addLabelIds.length > 0 || state.removeLabelIds.length > 0) &&
          email.mailboxId
        ) {
          const key = `${email.mailboxId}:${createMutationGroupKey(
            state.addLabelIds,
            state.removeLabelIds,
          )}`;
          const group = labelMutationGroups.get(key);

          if (group) {
            group.providerMessageIds.push(email.providerMessageId);
            group.rows.push(nextRow);
          } else {
            labelMutationGroups.set(key, {
              mailboxId: email.mailboxId,
              providerMessageIds: [email.providerMessageId],
              addLabelIds: state.addLabelIds,
              removeLabelIds: state.removeLabelIds,
              rows: [nextRow],
            });
          }
        } else {
          localOnlyRows.push(nextRow);
        }

        return nextRow;
      });

      await applyDbUpdates(db, user.id, localOnlyRows);

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
            emailIds: group.rows.map((row) => row.id),
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

        await applyDbUpdates(db, user.id, group.rows);
      }

      return c.json(
        {
          data: nextRows.map(({ id, state }) => ({
            id: String(id),
            isRead: state.isRead,
            archived: state.archived,
            trashed: state.trashed,
            spam: state.spam,
            starred: state.starred,
            snoozedUntil: state.snoozedUntil,
          })),
        },
        200,
      );
    },
  );
}
