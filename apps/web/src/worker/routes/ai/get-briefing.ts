import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { generateText } from "ai";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { dailyBriefings, emails, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const errorResponseSchema = z.object({ error: z.string() });
const briefingResponseSchema = z.object({
  data: z.object({
    text: z.string(),
  }),
});

const getBriefingRoute = createRoute({
  method: "get",
  path: "/briefing",
  tags: ["ai"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: briefingResponseSchema,
        },
      },
      description: "AI briefing",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

function getTodayBounds(now: number): { day: string; start: number; end: number } {
  const day = new Date(now).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { day, start, end };
}

function buildFallbackText(input: {
  unreadCount: number;
  dueTodayCount: number;
  overdueCount: number;
  stalePeopleCount: number;
}): string {
  return `${input.unreadCount} unread emails, ${input.dueTodayCount} tasks due today, ${input.overdueCount} overdue tasks, and ${input.stalePeopleCount} contacts to follow up after 7+ days.`;
}

async function buildBriefing(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
}) {
  const now = Date.now();
  const { day, start: dayStart, end: dayEnd } = getTodayBounds(now);
  const staleThreshold = now - 7 * 24 * 60 * 60 * 1000;

  const existing = await input.db
    .select({
      narrative: dailyBriefings.narrative,
    })
    .from(dailyBriefings)
    .where(and(eq(dailyBriefings.userId, input.userId), eq(dailyBriefings.date, day)))
    .limit(1);

  if (existing[0]?.narrative) {
    return existing[0].narrative;
  }

  const [unreadCountRows, dueTodayRows, overdueRows, stalePeopleRows] = await Promise.all([
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(and(eq(emails.userId, input.userId), eq(emails.isRead, false))),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, input.userId),
          gte(tasks.dueAt, dayStart),
          lte(tasks.dueAt, dayEnd),
        ),
      ),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), eq(tasks.done, false), lt(tasks.dueAt, now))),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(people)
      .where(and(eq(people.userId, input.userId), lt(people.lastContactedAt, staleThreshold))),
  ]);

  const unreadCount = Number(unreadCountRows[0]?.count ?? 0);
  const dueTodayCount = Number(dueTodayRows[0]?.count ?? 0);
  const overdueCount = Number(overdueRows[0]?.count ?? 0);
  const stalePeopleCount = Number(stalePeopleRows[0]?.count ?? 0);

  const fallbackText = buildFallbackText({
    unreadCount,
    dueTodayCount,
    overdueCount,
    stalePeopleCount,
  });

  let text = fallbackText;
  try {
    const workersAI = createWorkersAI({ binding: input.env.AI });
    const result = await generateText({
      model: workersAI(MODEL),
      system: [
        "Write exactly one short CRM status sentence in plain English.",
        "Be factual and neutral.",
        "Do not use alarmist or dramatic language.",
        "Never mention business loss, relationship strain, or immediate urgency.",
        "No markdown.",
      ].join(" "),
      prompt: [
        `Unread emails: ${unreadCount}`,
        `Tasks due today: ${dueTodayCount}`,
        `Overdue tasks: ${overdueCount}`,
        `People not contacted in 7+ days: ${stalePeopleCount}`,
      ].join("\n"),
      maxOutputTokens: 100,
    });

    const generated = (result.text ?? "").trim();
    if (generated) {
      text = generated;
    }
  } catch (error) {
    console.error("AI briefing generation failed", {
      userId: input.userId,
      route: "/api/ai/briefing",
      model: MODEL,
      error,
    });
  }

  await input.db
    .insert(dailyBriefings)
    .values({
      userId: input.userId,
      date: day,
      narrative: text,
      unreadCount,
      followUpCount: stalePeopleCount,
      tasksDueCount: dueTodayCount,
      overdueCount,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [dailyBriefings.userId, dailyBriefings.date],
      set: {
        narrative: text,
        unreadCount,
        followUpCount: stalePeopleCount,
        tasksDueCount: dueTodayCount,
        overdueCount,
      },
    });

  return text;
}

export function registerGetBriefing(app: OpenAPIHono<AppRouteEnv>) {
  app.openapi(getBriefingRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const text = await buildBriefing({ db, env: c.env, userId: user.id });
    return c.json({ data: { text } }, 200);
  });
}

export function registerPostBriefingStream(app: OpenAPIHono<AppRouteEnv>) {
  app.post("/briefing/stream", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const text = await buildBriefing({ db, env: c.env, userId: user.id });

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });
}
