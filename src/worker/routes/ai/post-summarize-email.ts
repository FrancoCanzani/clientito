import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { streamText } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const summarizeEmailBodySchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function registerPostSummarizeEmail(app: Hono<AppRouteEnv>) {
  app.post(
    "/summarize-email",
    zValidator("json", summarizeEmailBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { emailId } = c.req.valid("json");

      const emailRow = await db
        .select({
          id: emails.id,
          threadId: emails.threadId,
          fromAddr: emails.fromAddr,
          fromName: emails.fromName,
          subject: emails.subject,
          bodyText: emails.bodyText,
        })
        .from(emails)
        .where(and(eq(emails.id, emailId), eq(emails.userId, user.id)))
        .limit(1);

      const email = emailRow[0];
      if (!email) return c.json({ error: "Email not found" }, 404);

      let context = "";
      if (email.threadId) {
        const threadMessages = await db
          .select({
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            bodyText: emails.bodyText,
            date: emails.date,
          })
          .from(emails)
          .where(
            and(eq(emails.threadId, email.threadId), eq(emails.userId, user.id)),
          )
          .orderBy(asc(emails.date))
          .limit(10);

        context = threadMessages
          .map((msg, i) => {
            const from = msg.fromName || msg.fromAddr;
            const body = truncate(
              (msg.bodyText ?? "").replace(/\s+/g, " ").trim(),
              800,
            );
            return `--- Message ${i + 1} from ${from} ---\n${body}`;
          })
          .join("\n\n");
      } else {
        context = truncate(
          (email.bodyText ?? "").replace(/\s+/g, " ").trim(),
          2000,
        );
      }

      const systemPrompt =
        "You are a helpful email assistant. Summarize the email thread concisely in 2-4 bullet points. Focus on key information, action items, and decisions. Be brief.";

      const userPrompt = [
        `Subject: ${email.subject ?? "(no subject)"}`,
        "",
        context,
      ].join("\n");

      try {
        const workersAI = createWorkersAI({ binding: c.env.AI });
        const result = streamText({
          model: workersAI(MODEL),
          system: systemPrompt,
          prompt: userPrompt,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }

        const summary = fullText.trim();
        if (summary.length === 0) {
          return c.json({ error: "AI returned an empty summary" }, 500 as never);
        }

        return c.json({ data: { summary } }, 200);
      } catch (error) {
        console.error("Failed to summarize email", {
          userId: user.id,
          emailId,
          error,
        });
        return c.json({ error: "AI service unavailable" }, 500 as never);
      }
    },
  );
}
