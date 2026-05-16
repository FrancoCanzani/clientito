import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { aiThreadIntelligence } from "../../db/schema";
import { runThreadSummary } from "../../lib/ai/thread-summary";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { getUser } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { formatThreadPrompt, getThreadFreshness, threadMessageSchema } from "./shared";
import { handleAiRouteError } from "./utils";

const bodySchema = z.object({
  mailboxId: z.number().int().positive(),
  threadId: z.string().trim().min(1).max(120),
  messages: z.array(threadMessageSchema).min(1).max(100),
});

export function registerPostThreadSummary(app: Hono<AppRouteEnv>) {
  app.post("/thread-summary", zValidator("json", bodySchema), async (c) => {
    const { mailboxId, threadId, messages } = c.req.valid("json");
    const db = c.get("db");
    const user = getUser(c);
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const { ordered, sourceLastMessageId, sourceMessageCount } =
      getThreadFreshness(messages);
    const existing = await db.query.aiThreadIntelligence.findFirst({
      where: and(
        eq(aiThreadIntelligence.userId, user.id),
        eq(aiThreadIntelligence.mailboxId, mailboxId),
        eq(aiThreadIntelligence.threadId, threadId),
      ),
    });

    if (
      existing?.summary &&
      existing.sourceLastMessageId === sourceLastMessageId &&
      existing.sourceMessageCount === sourceMessageCount
    ) {
      return c.json({
        summary: existing.summary,
      });
    }

    try {
      const summary = await runThreadSummary({
        env: c.env,
        db,
        userId: user.id,
        mailbox,
        prompt: formatThreadPrompt(ordered),
      });
      const now = Date.now();
      await db
        .insert(aiThreadIntelligence)
        .values({
          userId: user.id,
          mailboxId,
          threadId,
          sourceLastMessageId,
          sourceMessageCount,
          summary: summary.summary,
          summaryUpdatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            aiThreadIntelligence.userId,
            aiThreadIntelligence.mailboxId,
            aiThreadIntelligence.threadId,
          ],
          set: {
            sourceLastMessageId,
            sourceMessageCount,
            summary: summary.summary,
            summaryUpdatedAt: now,
            updatedAt: now,
          },
        });
      return c.json(summary);
    } catch (error) {
      return handleAiRouteError(c, error, "Summary unavailable");
    }
  });
}
