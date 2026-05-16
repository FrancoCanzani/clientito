import type { Context } from "hono";
import { AiError } from "../../lib/ai/core/types";
import type { AppRouteEnv } from "../types";

export function handleAiRouteError(
  c: Context<AppRouteEnv>,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof AiError) {
    console.error("AI route failed", {
      path: c.req.path,
      code: error.code,
      message: error.message,
      error,
    });
    const status =
      error.code === "AI_DISABLED"
        ? 403
        : error.code === "AI_QUOTA_EXCEEDED"
          ? 429
          : 503;
    return c.json({ error: error.message, code: error.code }, status as never);
  }
  console.error("AI route failed", {
    path: c.req.path,
    code: "AI_PROVIDER_UNAVAILABLE",
    message: fallbackMessage,
    error,
  });
  return c.json(
    { error: fallbackMessage, code: "AI_PROVIDER_UNAVAILABLE" },
    503 as never,
  );
}
