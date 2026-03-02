import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { generateObject } from "ai";
import { and, desc, eq, gt } from "drizzle-orm";
import { z as zod } from "zod";
import { emails, people, peopleAiContext } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getAiErrorDetails } from "./ai-errors";
import { DEFAULT_WORKERS_AI_MODEL, getWorkersAIModel, truncate } from "./helpers";

const errorResponseSchema = z.object({ error: z.string() });
const personContextParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const personContextResponseSchema = z.object({
  data: z.object({
    briefing: z.string(),
    suggestedActions: z.array(z.string()),
  }),
});

const getPersonContextRoute = createRoute({
  method: "get",
  path: "/person/:id/context",
  tags: ["dashboard"],
  request: {
    params: personContextParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: personContextResponseSchema,
        },
      },
      description: "Person context",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

function parseSuggestedActions(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function registerGetPersonContext(app: OpenAPIHono<AppRouteEnv>) {
  app.openapi(getPersonContextRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const personRow = await db
      .select({ id: people.id, name: people.name, email: people.email })
      .from(people)
      .where(and(eq(people.id, id), eq(people.userId, user.id)))
      .limit(1);
    const person = personRow[0];
    if (!person) return c.json({ error: "Person not found" }, 404);

    const cachedRows = await db
      .select({
        id: peopleAiContext.id,
        briefing: peopleAiContext.briefing,
        suggestedActions: peopleAiContext.suggestedActions,
      })
      .from(peopleAiContext)
      .where(and(eq(peopleAiContext.personId, id), gt(peopleAiContext.generatedAt, oneHourAgo)))
      .orderBy(desc(peopleAiContext.generatedAt))
      .limit(1);
    const cached = cachedRows[0];

    if (cached?.briefing) {
      return c.json(
        {
          data: {
            briefing: cached.briefing,
            suggestedActions: parseSuggestedActions(cached.suggestedActions),
          },
        },
        200,
      );
    }

    const recentEmails = await db
      .select({
        subject: emails.subject,
        snippet: emails.snippet,
        date: emails.date,
      })
      .from(emails)
      .where(and(eq(emails.personId, id), eq(emails.userId, user.id)))
      .orderBy(desc(emails.date))
      .limit(20);

    const digest = recentEmails
      .map((email, idx) => {
        const subject = truncate((email.subject ?? "(no subject)").replace(/\s+/g, " ").trim(), 120);
        const snippet = truncate((email.snippet ?? "").replace(/\s+/g, " ").trim(), 220);
        return `${idx + 1}. Subject: ${subject}${snippet ? ` | Snippet: ${snippet}` : ""}`;
      })
      .join("\n");

    const outputSchema = zod.object({
      briefing: zod.string(),
      suggested_actions: zod.array(zod.string()),
    });

    let briefing = `Recent communication summary for ${person.name ?? person.email} is limited; review the latest thread and send a short follow-up.`;
    let suggestedActions: string[] = [
      "Review the latest email thread",
      "Send a concise follow-up",
    ];

    try {
      const { object } = await generateObject({
        model: getWorkersAIModel(c.env),
        schema: outputSchema,
        system:
          "You create concise CRM person context from email history. Keep outputs concrete and actionable.",
        prompt: [
          `Person: ${person.name ?? "(unknown)"} <${person.email}>`,
          "Based on the recent email digest, return JSON with keys briefing and suggested_actions.",
          "briefing should be 1-2 sentences max.",
          "suggested_actions should contain 2-5 short actions.",
          "",
          "Email digest:",
          digest || "No recent emails.",
        ].join("\n"),
      });

      const nextBriefing = truncate(object.briefing.trim(), 500);
      const nextActions = object.suggested_actions
        .map((action) => action.trim())
        .filter((action) => action.length > 0)
        .slice(0, 5);

      if (nextBriefing.length > 0) {
        briefing = nextBriefing;
      }
      if (nextActions.length > 0) {
        suggestedActions = nextActions;
      }
    } catch (error) {
      const aiError = getAiErrorDetails(error);
      console.error("Failed to generate person context, using fallback", {
        userId: user.id,
        personId: id,
        route: "/api/dashboard/person/:id/context",
        model: DEFAULT_WORKERS_AI_MODEL,
        aiError,
      });
    }

    const existingRows = await db
      .select({ id: peopleAiContext.id })
      .from(peopleAiContext)
      .where(eq(peopleAiContext.personId, id))
      .orderBy(desc(peopleAiContext.generatedAt))
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      await db
        .update(peopleAiContext)
        .set({
          briefing,
          suggestedActions: JSON.stringify(suggestedActions),
          generatedAt: now,
        })
        .where(eq(peopleAiContext.id, existing.id));
    } else {
      await db.insert(peopleAiContext).values({
        personId: id,
        briefing,
        suggestedActions: JSON.stringify(suggestedActions),
        generatedAt: now,
      });
    }

    return c.json({ data: { briefing, suggestedActions } }, 200);
  });
}
