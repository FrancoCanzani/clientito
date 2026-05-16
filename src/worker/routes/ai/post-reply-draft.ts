import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { aiThreadIntelligence } from "../../db/schema";
import { runReplyDraft } from "../../lib/ai/reply-draft";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { getUser } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import {
  formatStyleSamples,
  formatThreadPrompt,
  getThreadFreshness,
  isSelfAuthoredMessage,
  sentStyleSampleSchema,
  threadMessageSchema,
} from "./shared";
import { handleAiRouteError } from "./utils";

const bodySchema = z.object({
  mailboxId: z.number().int().positive(),
  threadId: z.string().trim().min(1).max(120),
  messages: z.array(threadMessageSchema).min(1).max(100),
  styleSamples: z.array(sentStyleSampleSchema).max(5).optional().default([]),
  selfEmails: z.array(z.string().email()).max(10).optional().default([]),
  mailboxEmail: z.string().email().nullable().optional(),
  replyToMessageId: z.string().nullable().optional(),
  intent: z.enum(["reply", "accept", "decline", "follow_up"]).optional(),
  tone: z.enum(["neutral", "warm", "formal", "concise"]).optional(),
});

export function registerPostReplyDraft(app: Hono<AppRouteEnv>) {
  app.post("/reply-draft", zValidator("json", bodySchema), async (c) => {
    const {
      mailboxId,
      threadId,
      messages,
      styleSamples,
      selfEmails,
      mailboxEmail,
      replyToMessageId,
      intent,
      tone,
    } = c.req.valid("json");
    const db = c.get("db");
    const user = getUser(c);
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const { ordered, sourceLastMessageId, sourceMessageCount } =
      getThreadFreshness(messages);
    if (isSelfAuthoredMessage(ordered[ordered.length - 1], selfEmails)) {
      return c.json(
        { error: "Latest message was sent by the mailbox owner" },
        409,
      );
    }
    const prompt = [
      intent ? `Intent: ${intent}` : null,
      tone ? `Tone: ${tone}` : null,
      mailboxEmail ? `You are writing as: ${mailboxEmail}` : null,
      selfEmails.length > 0
        ? `Messages from these addresses are authored by the mailbox owner: ${selfEmails.join(", ")}`
        : null,
      replyToMessageId ? `Reply to message id: ${replyToMessageId}` : null,
      styleSamples.length > 0 ? "Style examples from the mailbox owner:" : null,
      styleSamples.length > 0 ? formatStyleSamples(styleSamples) : null,
      styleSamples.length > 0
        ? "Use the style examples only for tone and writing style. Do not use them as factual context."
        : null,
      "Current thread:",
      "",
      formatThreadPrompt(ordered),
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      const draft = await runReplyDraft({
        env: c.env,
        db,
        userId: user.id,
        mailbox,
        prompt,
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
          latestReplyDraftBody: draft.body,
          latestReplyDraftIntent: intent ?? null,
          latestReplyDraftTone: tone ?? null,
          replyDraftUpdatedAt: now,
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
            latestReplyDraftBody: draft.body,
            latestReplyDraftIntent: intent ?? null,
            latestReplyDraftTone: tone ?? null,
            replyDraftUpdatedAt: now,
            updatedAt: now,
          },
        });
      return c.json({ ...draft, intent: intent ?? null, tone: tone ?? null });
    } catch (error) {
      return handleAiRouteError(c, error, "Reply draft unavailable");
    }
  });
}
