import type { mailboxes } from "../../../db/schema";
import { AiError, type AiFeature, type AiPlan } from "./types";

export function resolveAiPlan(): AiPlan {
  return "free";
}

export function assertAiAllowed(
  mailbox: typeof mailboxes.$inferSelect,
  _feature: AiFeature,
) {
  if (!mailbox.aiEnabled) {
    throw new AiError("AI_DISABLED", "AI features are disabled for this mailbox");
  }
}
