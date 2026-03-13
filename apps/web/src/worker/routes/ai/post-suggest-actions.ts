import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateText, Output } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { emails, emailSuggestions } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const suggestActionsBodySchema = z.object({
  emailIds: z.array(z.coerce.number().int().positive()).min(1).max(10),
});

const suggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      email_id: z.number(),
      actions: z.array(
        z.object({
          action_type: z.enum(["add_task", "draft_reply", "archive", "follow_up"]),
          label: z.string(),
          params: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
  ),
});

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function registerPostSuggestActions(app: Hono<AppRouteEnv>) {
  app.post(
    "/suggest-actions",
    zValidator("json", suggestActionsBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { emailIds } = c.req.valid("json");

      // Dedup: find emails that already have pending suggestions
      const existingSuggestions = await db
        .select({ emailId: emailSuggestions.emailId })
        .from(emailSuggestions)
        .where(
          and(
            eq(emailSuggestions.userId, user.id),
            eq(emailSuggestions.status, "pending"),
            inArray(emailSuggestions.emailId, emailIds),
          ),
        );

      const alreadySuggestedIds = new Set(existingSuggestions.map((s) => s.emailId));
      const newEmailIds = emailIds.filter((id) => !alreadySuggestedIds.has(id));

      if (newEmailIds.length === 0) {
        // Return existing pending suggestions for requested emails
        const existing = await db
          .select()
          .from(emailSuggestions)
          .where(
            and(
              eq(emailSuggestions.userId, user.id),
              eq(emailSuggestions.status, "pending"),
              inArray(emailSuggestions.emailId, emailIds),
            ),
          );
        return c.json({ data: existing }, 200);
      }

      // Fetch email details
      const emailRows = await db
        .select({
          id: emails.id,
          subject: emails.subject,
          snippet: emails.snippet,
          fromAddr: emails.fromAddr,
          fromName: emails.fromName,
          labelIds: emails.labelIds,
        })
        .from(emails)
        .where(
          and(
            eq(emails.userId, user.id),
            inArray(emails.id, newEmailIds),
          ),
        );

      if (emailRows.length === 0) {
        return c.json({ data: [] }, 200);
      }

      const digest = emailRows
        .map((email) => {
          const subject = truncate((email.subject ?? "(no subject)").replace(/\s+/g, " ").trim(), 120);
          const snippet = truncate((email.snippet ?? "").replace(/\s+/g, " ").trim(), 220);
          const from = email.fromName || email.fromAddr;
          const labels = (email.labelIds as string[] | null)?.join(", ") ?? "";
          return `Email ID ${email.id}: From: ${from} | Subject: ${subject} | Snippet: ${snippet} | Labels: ${labels}`;
        })
        .join("\n");

      try {
        const workersAI = createWorkersAI({ binding: c.env.AI });
        const result = await generateText({
          model: workersAI(MODEL),
          output: Output.object({ schema: suggestionSchema }),
          system: [
            "You analyze emails and suggest quick actions. For each email, suggest 1-2 actions.",
            "Action types:",
            "- add_task: for emails about meetings, deadlines, requests. Include title and optional dueAt (ISO string) in params.",
            "- draft_reply: for questions, invitations, requests needing response. Include instructions in params.",
            "- archive: for newsletters, notifications, automated emails with no action needed.",
            "- follow_up: for emails needing future attention. Include title and dueAt (ISO string) in params.",
            "Labels should be short (2-4 words), human-friendly action descriptions like 'Add to tasks', 'Reply accepting', 'Archive', 'Follow up Friday'.",
            "Return JSON with a suggestions array. Each entry has email_id and actions array.",
          ].join(" "),
          prompt: `Analyze these emails and suggest actions:\n\n${digest}`,
        });

        const output = result.output;
        const now = Date.now();
        const insertedSuggestions: Array<typeof emailSuggestions.$inferInsert> = [];

        for (const emailSuggestion of output.suggestions) {
          // Only process emails we actually requested
          if (!newEmailIds.includes(emailSuggestion.email_id)) continue;

          for (const action of emailSuggestion.actions) {
            const suggestion = {
              userId: user.id,
              emailId: emailSuggestion.email_id,
              actionType: action.action_type,
              label: truncate(action.label, 50),
              params: action.params ?? null,
              status: "pending" as const,
              createdAt: now,
            };
            insertedSuggestions.push(suggestion);
          }
        }

        if (insertedSuggestions.length > 0) {
          await db.insert(emailSuggestions).values(insertedSuggestions);
        }

        // Return all pending suggestions for requested emails
        const allSuggestions = await db
          .select()
          .from(emailSuggestions)
          .where(
            and(
              eq(emailSuggestions.userId, user.id),
              eq(emailSuggestions.status, "pending"),
              inArray(emailSuggestions.emailId, emailIds),
            ),
          );

        return c.json({ data: allSuggestions }, 200);
      } catch (error) {
        console.error("Failed to generate email suggestions", {
          userId: user.id,
          emailIds: newEmailIds,
          error,
        });
        return c.json({ error: "AI service unavailable" }, 500 as never);
      }
    },
  );
}
