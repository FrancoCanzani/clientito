import { threadSummarySchema } from "../thread-summary/schema";
import type { z } from "zod";
import type { AiFeature, AiFeatureConfig } from "./types";

const configs: Record<AiFeature, AiFeatureConfig<z.ZodTypeAny | null>> = {
  grammar_check: {
    feature: "grammar_check",
    modelRoute: "writing",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 800,
    reasoning: "default",
    schema: null,
  },
  rewrite_improve: {
    feature: "rewrite_improve",
    modelRoute: "writing",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 1200,
    reasoning: "default",
    schema: null,
  },
  rewrite_formal: {
    feature: "rewrite_formal",
    modelRoute: "writing",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 1200,
    reasoning: "default",
    schema: null,
  },
  rewrite_casual: {
    feature: "rewrite_casual",
    modelRoute: "writing",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 1200,
    reasoning: "default",
    schema: null,
  },
  rewrite_shorten: {
    feature: "rewrite_shorten",
    modelRoute: "writing",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 800,
    reasoning: "default",
    schema: null,
  },
  thread_summary: {
    feature: "thread_summary",
    modelRoute: "thread-summary",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 300,
    reasoning: "off",
    schema: threadSummarySchema,
  },
  reply_draft: {
    feature: "reply_draft",
    modelRoute: "reply-draft",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    maxOutputTokens: 1200,
    reasoning: "off",
    schema: null,
  },
};

export function matchAiFeature(feature: AiFeature) {
  return configs[feature];
}
