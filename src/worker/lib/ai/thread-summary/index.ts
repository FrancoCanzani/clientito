import { generateObject } from "ai";
import type { Database } from "../../../db/client";
import type { mailboxes } from "../../../db/schema";
import { createAiModel } from "../core/gateway";
import { assertAiAllowed, resolveAiPlan } from "../core/policy";
import { matchAiFeature } from "../core/router";
import { AiError } from "../core/types";
import { recordAiUsage } from "../core/usage";
import { THREAD_SUMMARY_SYSTEM } from "./prompt";
import { threadSummarySchema } from "./schema";

export async function runThreadSummary(input: {
  env: Env;
  db: Database;
  userId: string;
  mailbox: typeof mailboxes.$inferSelect;
  prompt: string;
}) {
  assertAiAllowed(input.mailbox, "thread_summary");
  const plan = resolveAiPlan();
  const config = matchAiFeature("thread_summary");
  const requestId = crypto.randomUUID();
  const metadata = {
    userId: input.userId,
    mailboxId: input.mailbox.id,
    feature: "thread_summary" as const,
    plan,
    requestId,
  };

  try {
    const result = await generateObject({
      model: createAiModel(input.env, metadata, config),
      system: THREAD_SUMMARY_SYSTEM,
      prompt: input.prompt,
      schema: threadSummarySchema,
      maxOutputTokens: config.maxOutputTokens,
    });
    await recordAiUsage(input.db, {
      ...metadata,
      modelRoute: config.modelRoute,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      status: "succeeded",
    });
    return result.object;
  } catch (error) {
    const aiError =
      error instanceof AiError
        ? error
        : new AiError("AI_INVALID_OUTPUT", "Summary unavailable");
    console.error("AI thread summary failed", {
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
