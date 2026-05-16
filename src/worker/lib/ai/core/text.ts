import { generateText } from "ai";
import type { Database } from "../../../db/client";
import type { mailboxes } from "../../../db/schema";
import { createAiModel } from "./gateway";
import { assertAiAllowed, resolveAiPlan } from "./policy";
import { matchAiFeature } from "./router";
import { AiError, type AiFeature } from "./types";
import { recordAiUsage } from "./usage";

type TextFeature = Extract<
  AiFeature,
  | "grammar_check"
  | "rewrite_improve"
  | "rewrite_formal"
  | "rewrite_casual"
  | "rewrite_shorten"
>;

export async function runTextFeature(input: {
  env: Env;
  db: Database;
  userId: string;
  mailbox: typeof mailboxes.$inferSelect;
  feature: TextFeature;
  system: string;
  text: string;
}) {
  assertAiAllowed(input.mailbox, input.feature);
  const plan = resolveAiPlan();
  const config = matchAiFeature(input.feature);
  const requestId = crypto.randomUUID();
  const metadata = {
    userId: input.userId,
    mailboxId: input.mailbox.id,
    feature: input.feature,
    plan,
    requestId,
  };

  try {
    const result = await generateText({
      model: createAiModel(input.env, metadata, config),
      system: input.system,
      prompt: input.text,
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
    return result.text.trim();
  } catch (error) {
    const aiError =
      error instanceof AiError
        ? error
        : new AiError("AI_PROVIDER_UNAVAILABLE", "AI provider unavailable");
    console.error("AI text feature failed", {
      feature: input.feature,
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
