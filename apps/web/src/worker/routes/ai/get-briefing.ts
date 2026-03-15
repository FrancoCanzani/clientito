import type { Hono } from "hono";
import { generateText } from "ai";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { dailyBriefings, emails, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BRIEFING_TTL_MS = 10 * 60 * 1000;

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
}): string {
  return `${input.unreadCount} unread emails, ${input.dueTodayCount} tasks due today, and ${input.overdueCount} overdue tasks.`;
}

type BriefingData = {
  text: string;
  generatedAt: number;
  counts: {
    unread: number;
    dueToday: number;
    overdue: number;
    followUps: number;
  };
};

async function buildBriefing(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
}): Promise<BriefingData> {
  const now = Date.now();
  const { day, start: dayStart, end: dayEnd } = getTodayBounds(now);

  const existing = await input.db
    .select({
      narrative: dailyBriefings.narrative,
      unreadCount: dailyBriefings.unreadCount,
      tasksDueCount: dailyBriefings.tasksDueCount,
      overdueCount: dailyBriefings.overdueCount,
      followUpCount: dailyBriefings.followUpCount,
      createdAt: dailyBriefings.createdAt,
    })
    .from(dailyBriefings)
    .where(and(eq(dailyBriefings.userId, input.userId), eq(dailyBriefings.date, day)))
    .limit(1);

  if (
    existing[0]?.narrative &&
    existing[0].createdAt >= now - BRIEFING_TTL_MS
  ) {
    return {
      text: existing[0].narrative,
      generatedAt: existing[0].createdAt,
      counts: {
        unread: Number(existing[0].unreadCount ?? 0),
        dueToday: Number(existing[0].tasksDueCount ?? 0),
        overdue: Number(existing[0].overdueCount ?? 0),
        followUps: Number(existing[0].followUpCount ?? 0),
      },
    };
  }

  const [unreadCountRows, dueTodayRows, overdueRows] = await Promise.all([
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
          eq(tasks.done, false),
          gte(tasks.dueAt, dayStart),
          lte(tasks.dueAt, dayEnd),
        ),
      ),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), eq(tasks.done, false), lt(tasks.dueAt, now))),
  ]);

  const unreadCount = Number(unreadCountRows[0]?.count ?? 0);
  const dueTodayCount = Number(dueTodayRows[0]?.count ?? 0);
  const overdueCount = Number(overdueRows[0]?.count ?? 0);

  const fallbackText = buildFallbackText({
    unreadCount,
    dueTodayCount,
    overdueCount,
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

  try {
    await input.db
      .insert(dailyBriefings)
      .values({
        userId: input.userId,
        date: day,
        narrative: text,
        unreadCount,
        followUpCount: 0,
        tasksDueCount: dueTodayCount,
        overdueCount,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyBriefings.userId, dailyBriefings.date],
        set: {
          narrative: text,
          unreadCount,
          followUpCount: 0,
          tasksDueCount: dueTodayCount,
          overdueCount,
          createdAt: now,
        },
      });
  } catch {
    // FK constraint can fail if user doesn't exist yet (stale session)
  }

  return {
    text,
    generatedAt: now,
    counts: {
      unread: unreadCount,
      dueToday: dueTodayCount,
      overdue: overdueCount,
      followUps: 0,
    },
  };
}

export function registerGetBriefing(app: Hono<AppRouteEnv>) {
  app.get("/briefing", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const briefing = await buildBriefing({ db, env: c.env, userId: user.id });
    return c.json({ data: briefing }, 200);
  });
}

export function registerPostBriefingStream(app: Hono<AppRouteEnv>) {
  app.post("/briefing/stream", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const briefing = await buildBriefing({ db, env: c.env, userId: user.id });

    return new Response(briefing.text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });
}
