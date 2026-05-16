import { aiUsageEvents } from "../../../db/schema";
import type { Database } from "../../../db/client";
import type { AiErrorCode, AiFeature, AiPlan } from "./types";

export async function recordAiUsage(
  db: Database,
  input: {
    userId: string;
    mailboxId: number;
    feature: AiFeature;
    plan: AiPlan;
    modelRoute: string;
    requestId: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    status: "succeeded" | "failed";
    errorCode?: AiErrorCode | null;
  },
) {
  await db.insert(aiUsageEvents).values({
    userId: input.userId,
    mailboxId: input.mailboxId,
    feature: input.feature,
    plan: input.plan,
    modelRoute: input.modelRoute,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    totalTokens: input.totalTokens ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    requestId: input.requestId,
    createdAt: Date.now(),
  });
}
