import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import type { Database } from "../../db/client";
import { emails } from "../../db/schema";
import { batchModifyGmailMessages } from "../../lib/gmail/mailbox";
import type { AppRouteEnv } from "../types";
import { applyEmailPatch } from "./mutation";
import { batchPatchEmailsBodySchema } from "./schemas";

type GmailMutationGroup = {
  gmailIds: string[];
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

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
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

  await Promise.all(
    updates.map(({ id, state }) =>
      db
        .update(emails)
        .set(state.dbUpdates)
        .where(and(eq(emails.userId, userId), eq(emails.id, id))),
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
              gmailId: emails.gmailId,
              isRead: emails.isRead,
              labelIds: emails.labelIds,
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

      const gmailMutationGroups = new Map<string, GmailMutationGroup>();
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

        if (state.addLabelIds.length > 0 || state.removeLabelIds.length > 0) {
          const key = createMutationGroupKey(
            state.addLabelIds,
            state.removeLabelIds,
          );
          const group = gmailMutationGroups.get(key);

          if (group) {
            group.gmailIds.push(email.gmailId);
            group.rows.push(nextRow);
          } else {
            gmailMutationGroups.set(key, {
              gmailIds: [email.gmailId],
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

      for (const group of gmailMutationGroups.values()) {
        try {
          await batchModifyGmailMessages(
            db,
            c.env,
            user.id,
            group.gmailIds,
            group.addLabelIds,
            group.removeLabelIds,
          );
        } catch (error) {
          console.warn("Gmail batch modify failed", {
            error,
            emailIds: group.rows.map((row) => row.id),
          });
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update Gmail messages",
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
          })),
        },
        200,
      );
    },
  );
}
