import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const generateSchema = z.object({
  prompt: z.string().min(1).max(500),
});

const filterOutputSchema = z.object({
  name: z.string(),
  description: z.string(),
  actions: z.object({
    archive: z.boolean().optional(),
    markRead: z.boolean().optional(),
    star: z.boolean().optional(),
    trash: z.boolean().optional(),
  }),
});

export function registerGenerateFilter(app: Hono<AppRouteEnv>) {
  app.post("/generate", zValidator("json", generateSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { prompt } = c.req.valid("json");
    const db = c.get("db");

    const recentEmails = await db
      .select({
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        subject: emails.subject,
      })
      .from(emails)
      .where(eq(emails.userId, user.id))
      .orderBy(desc(emails.date))
      .limit(30);

    const senderSample = [
      ...new Set(
        recentEmails.map(
          (e) => `${e.fromName ?? ""} <${e.fromAddr}>: ${e.subject ?? ""}`,
        ),
      ),
    ]
      .slice(0, 15)
      .join("\n");

    const workersAI = createWorkersAI({ binding: c.env.AI });

    const { object: filter } = await generateObject({
      model: workersAI(MODEL),
      schema: filterOutputSchema,
      prompt: `You are an email filter generator. The user describes what they want in plain English and you create an email filter.

The filter has three parts:
1. "name" — a short human-readable name for the filter (3-6 words)
2. "description" — a clear, specific description of which emails this filter should match. Be precise about sender patterns, subject patterns, or email types. This description will be used by an AI classifier to match incoming emails, so make it unambiguous.
3. "actions" — what to do with matching emails: "archive" (remove from inbox), "markRead" (mark as read), "star" (star it), "trash" (move to trash)

Here are some of the user's recent senders for context:
${senderSample}

User request: "${prompt}"

Generate the filter.`,
    });

    return c.json({ data: filter });
  });
}
