import { generateText } from "ai";
import type { Database } from "../../../db/client";
import type { mailboxes } from "../../../db/schema";
import { createAiModel } from "../core/gateway";
import { assertAiAllowed, resolveAiPlan } from "../core/policy";
import { matchAiFeature } from "../core/router";
import { AiError } from "../core/types";
import { recordAiUsage } from "../core/usage";
import { REPLY_DRAFT_SYSTEM } from "./prompt";

export async function runReplyDraft(input: {
  env: Env;
  db: Database;
  userId: string;
  mailbox: typeof mailboxes.$inferSelect;
  prompt: string;
}) {
  assertAiAllowed(input.mailbox, "reply_draft");
  const plan = resolveAiPlan();
  const config = matchAiFeature("reply_draft");
  const requestId = crypto.randomUUID();
  const metadata = {
    userId: input.userId,
    mailboxId: input.mailbox.id,
    feature: "reply_draft" as const,
    plan,
    requestId,
  };

  try {
    const result = await generateText({
      model: createAiModel(input.env, metadata, config),
      system: REPLY_DRAFT_SYSTEM,
      prompt: input.prompt,
      maxOutputTokens: config.maxOutputTokens,
    });
    const body = result.text.trim();
    if (!body) {
      console.error("AI reply draft returned empty text", {
        mailboxId: input.mailbox.id,
        userId: input.userId,
        modelRoute: config.modelRoute,
        provider: config.provider,
        model: config.model,
        requestId,
        finishReason: result.finishReason,
        usage: result.usage,
      });
      throw new AiError("AI_INVALID_OUTPUT", "Reply draft unavailable");
    }
    await recordAiUsage(input.db, {
      ...metadata,
      modelRoute: config.modelRoute,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      status: "succeeded",
    });
    return { body };
  } catch (error) {
    const aiError =
      error instanceof AiError
        ? error
        : new AiError("AI_INVALID_OUTPUT", "Reply draft unavailable");
    console.error("AI reply draft failed", {
      mailboxId: input.mailbox.id,
      userId: input.userId,
      modelRoute: config.modelRoute,
      provider: config.provider,
      model: config.model,
      requestId,
      code: aiError.code,
      error,
    });
    await recordAiUsage(input.db, {
      ...metadata,
      modelRoute: config.modelRoute,
      status: "failed",
      errorCode: aiError.code,
    });
    throw aiError;
  }
}
