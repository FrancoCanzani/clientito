import type { z } from "zod";

export type AiFeature =
  | "grammar_check"
  | "rewrite_improve"
  | "rewrite_formal"
  | "rewrite_casual"
  | "rewrite_shorten"
  | "thread_summary"
  | "reply_draft";

export type AiPlan = "free" | "pro";

export type AiErrorCode =
  | "AI_DISABLED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_INVALID_OUTPUT";

export type AiFeatureConfig<TSchema extends z.ZodTypeAny | null = null> = {
  feature: AiFeature;
  modelRoute: string;
  provider: "openai" | "workers-ai";
  model: string;
  maxOutputTokens: number;
  reasoning: "off" | "default";
  schema: TSchema;
};

export type AiRequestMetadata = {
  userId: string;
  mailboxId: number;
  feature: AiFeature;
  plan: AiPlan;
  requestId: string;
};

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}
