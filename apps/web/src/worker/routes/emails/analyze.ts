import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { buildSystemPrompt, getOrgAIContext } from "../../lib/ai-context";
import { getAiErrorDetails } from "../../lib/ai-errors";
import {
  DEFAULT_WORKERS_AI_MODEL,
  getWorkersAIModel,
  truncate,
} from "../classify/helpers";
import type { AppRouteEnv } from "../types";
import {
  analyzeEmailQuerySchema,
  emailAnalysisResponseSchema,
  errorResponseSchema,
} from "./schemas";

const analysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative", "urgent"]),
  suggestedTasks: z
    .array(z.object({ message: z.string(), dueInDays: z.number() }))
    .max(3),
  language: z.string(),
  translation: z.string().nullable(),
});

const analyzeEmailRoute = createRoute({
  method: "get",
  path: "/analyze",
  tags: ["emails"],
  request: { query: analyzeEmailQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: emailAnalysisResponseSchema } },
      description: "Email analysis",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
    503: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "AI provider unavailable",
    },
  },
});

export function registerGetEmailAnalysis(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(analyzeEmailRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, emailId } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const row = await db
      .select({
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        subject: emails.subject,
        bodyText: emails.bodyText,
        snippet: emails.snippet,
        customerId: emails.customerId,
      })
      .from(emails)
      .where(and(eq(emails.orgId, orgId), eq(emails.id, emailId)))
      .limit(1);

    const email = row[0];
    if (!email) return c.json({ error: "Email not found" }, 404);

    const aiContext = await getOrgAIContext(db, orgId);

    const basePrompt = [
      "Analyze this email and provide:",
      "1. A 2-3 sentence summary",
      "2. Sentiment (positive, neutral, negative, or urgent)",
      "3. Up to 3 suggested follow-up tasks with due dates (in days from now)",
      "4. The detected language code (e.g. 'en', 'es', 'fr')",
      "5. If the email is NOT in Spanish, provide a Spanish translation of the body. If already in Spanish, set translation to null.",
    ].join("\n");

    const body = truncate(email.bodyText ?? email.snippet, 2000);

    try {
      const { output } = await generateText({
        model: getWorkersAIModel(c.env),
        output: Output.object({ schema: analysisSchema }),
        system: buildSystemPrompt(basePrompt, aiContext),
        prompt: [
          `From: ${email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr}`,
          `Subject: ${email.subject ?? "(no subject)"}`,
          `Body: ${body}`,
        ].join("\n"),
        temperature: 0,
      });

      return c.json({ data: output }, 200);
    } catch (error) {
      const aiError = getAiErrorDetails(error);
      const logData = {
        orgId,
        emailId,
        route: "/api/emails/analyze",
        model: DEFAULT_WORKERS_AI_MODEL,
        cfRay: c.req.header("cf-ray") ?? null,
        aiError,
      };

      if (aiError.code === 1031) {
        console.warn("Email analysis AI unavailable", {
          ...logData,
          diagnosis:
            "Workers AI upstream failure (provider-side transient). This is not caused by prompt or local email data.",
        });
      } else {
        console.error("Email analysis failed", {
          ...logData,
        });
      }

      return c.json(
        { error: "AI is temporarily unavailable. Please retry in a moment." },
        503,
      );
    }
  });
}
