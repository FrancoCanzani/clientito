import { generateText } from "ai";
import type { Hono } from "hono";
import { ensureOrgAccess } from "../../lib/access";
import { getAiErrorDetails } from "../../lib/ai-errors";
import {
  DEFAULT_WORKERS_AI_MODEL,
  getWorkersAIModel,
} from "../classify/helpers";
import type { AppRouteEnv } from "../types";
import { buildDashboardBriefingPayload } from "./briefing-content";

export function registerGetBriefing(app: Hono<AppRouteEnv>) {
  app.get("/briefing", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const orgId = c.req.query("orgId");
    if (!orgId) return c.json({ error: "orgId required" }, 400);
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const briefingPayload = await buildDashboardBriefingPayload({ db, orgId });

    try {
      const { text } = await generateText({
        model: getWorkersAIModel(c.env),
        system: briefingPayload.system,
        prompt: briefingPayload.prompt,
      });

      const normalizedText = typeof text === "string" ? text.trim() : "";
      return c.json(
        {
          data: {
            text:
              normalizedText.length > 0
                ? normalizedText
                : briefingPayload.fallbackText,
          },
        },
        200,
      );
    } catch (error) {
      const aiError = getAiErrorDetails(error);
      const logData = {
        orgId,
        route: "/api/dashboard/briefing",
        model: DEFAULT_WORKERS_AI_MODEL,
        cfRay: c.req.header("cf-ray") ?? null,
        context: briefingPayload.context,
        aiError,
      };

      if (aiError.code === 1031) {
        console.warn("Dashboard briefing AI unavailable, using fallback", {
          ...logData,
          diagnosis:
            "Workers AI upstream failure (provider-side transient). This is not caused by prompt or local DB data.",
        });
      } else {
        console.error("Dashboard briefing generation failed", {
          ...logData,
        });
      }

      return c.json({ data: { text: briefingPayload.fallbackText } }, 200);
    }
  });
}
