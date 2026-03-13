import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { emails, emailSuggestions, tasks } from "../../db/schema";
import { archiveGmailMessage } from "../../lib/gmail/modify";
import type { AppRouteEnv } from "../types";

const executeSuggestionBodySchema = z.object({
  suggestionId: z.coerce.number().int().positive(),
});

const dismissSuggestionBodySchema = z.object({
  suggestionId: z.coerce.number().int().positive(),
});

export function registerPostExecuteSuggestion(app: Hono<AppRouteEnv>) {
  app.post(
    "/execute-suggestion",
    zValidator("json", executeSuggestionBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { suggestionId } = c.req.valid("json");

      const rows = await db
        .select()
        .from(emailSuggestions)
        .where(
          and(
            eq(emailSuggestions.id, suggestionId),
            eq(emailSuggestions.userId, user.id),
            eq(emailSuggestions.status, "pending"),
          ),
        )
        .limit(1);

      const suggestion = rows[0];
      if (!suggestion) return c.json({ error: "Suggestion not found" }, 404);

      const params = (suggestion.params ?? {}) as Record<string, unknown>;
      const now = Date.now();

      switch (suggestion.actionType) {
        case "add_task": {
          const title = (params.title as string) || suggestion.label;
          const dueAt = params.dueAt ? new Date(params.dueAt as string).getTime() : null;
          const personId = (params.personId as number) ?? null;

          await db.insert(tasks).values({
            userId: user.id,
            title,
            dueAt,
            personId,
            createdAt: now,
          });
          break;
        }

        case "follow_up": {
          const title = (params.title as string) || suggestion.label;
          const dueAt = params.dueAt ? new Date(params.dueAt as string).getTime() : null;

          await db.insert(tasks).values({
            userId: user.id,
            title,
            dueAt,
            createdAt: now,
          });
          break;
        }

        case "archive": {
          const emailRow = await db
            .select({
              id: emails.id,
              gmailId: emails.gmailId,
              labelIds: emails.labelIds,
            })
            .from(emails)
            .where(
              and(
                eq(emails.id, suggestion.emailId),
                eq(emails.userId, user.id),
              ),
            )
            .limit(1);

          const email = emailRow[0];
          if (email) {
            const labelIds = (email.labelIds as string[] | null) ?? [];
            if (labelIds.includes("INBOX")) {
              await db
                .update(emails)
                .set({ labelIds: labelIds.filter((l) => l !== "INBOX") })
                .where(eq(emails.id, email.id));

              c.executionCtx.waitUntil(
                archiveGmailMessage(db, c.env, user.id, email.gmailId).catch((err) =>
                  console.warn("Gmail archive failed", { err }),
                ),
              );
            }
          }
          break;
        }

        case "draft_reply": {
          // For draft_reply, we return the suggestion info so the frontend
          // can call the existing draft-reply endpoint with instructions
          await db
            .update(emailSuggestions)
            .set({ status: "accepted" })
            .where(eq(emailSuggestions.id, suggestionId));

          return c.json({
            data: {
              executed: true,
              actionType: "draft_reply",
              emailId: suggestion.emailId,
              instructions: params.instructions as string | undefined,
            },
          }, 200);
        }
      }

      await db
        .update(emailSuggestions)
        .set({ status: "accepted" })
        .where(eq(emailSuggestions.id, suggestionId));

      return c.json({ data: { executed: true, actionType: suggestion.actionType } }, 200);
    },
  );
}

export function registerPostDismissSuggestion(app: Hono<AppRouteEnv>) {
  app.post(
    "/dismiss-suggestion",
    zValidator("json", dismissSuggestionBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { suggestionId } = c.req.valid("json");

      await db
        .update(emailSuggestions)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(emailSuggestions.id, suggestionId),
            eq(emailSuggestions.userId, user.id),
            eq(emailSuggestions.status, "pending"),
          ),
        );

      return c.json({ data: { dismissed: true } }, 200);
    },
  );
}
