import { streamText } from "ai";
import type { Hono } from "hono";
import { ensureOrgAccess } from "../../lib/access";
import { getAiErrorDetails } from "../../lib/ai-errors";
import {
  DEFAULT_WORKERS_AI_MODEL,
  getWorkersAIModel,
} from "../classify/helpers";
import type { AppRouteEnv } from "../types";
import { buildDashboardBriefingPayload } from "./briefing-content";

type BriefingStreamRequest = {
  orgId?: string;
};

export function registerPostBriefingStream(app: Hono<AppRouteEnv>) {
  app.post("/briefing/stream", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as BriefingStreamRequest;
    const orgId = body.orgId?.trim();
    if (!orgId) return c.json({ error: "orgId required" }, 400);
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const briefingPayload = await buildDashboardBriefingPayload({ db, orgId });

    try {
      const result = streamText({
        model: getWorkersAIModel(c.env),
        system: briefingPayload.system,
        prompt: briefingPayload.prompt,
      });

      return result.toTextStreamResponse({
        headers: {
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const aiError = getAiErrorDetails(error);
      const logData = {
        orgId,
        route: "/api/dashboard/briefing/stream",
        model: DEFAULT_WORKERS_AI_MODEL,
        cfRay: c.req.header("cf-ray") ?? null,
        context: briefingPayload.context,
        aiError,
      };

      if (aiError.code === 1031) {
        console.warn("Dashboard briefing stream AI unavailable, using fallback", {
          ...logData,
          diagnosis:
            "Workers AI upstream failure (provider-side transient). This is not caused by prompt or local DB data.",
        });
      } else {
        console.error("Dashboard briefing stream generation failed", logData);
      }

      return new Response(briefingPayload.fallbackText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  });
}
