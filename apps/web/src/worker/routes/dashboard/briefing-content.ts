import { generateText } from "ai";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { dailyBriefings, emails, people, tasks } from "../../db/schema";
import { buildSystemPrompt } from "./ai-context";
import { getAiErrorDetails } from "./ai-errors";
import { DEFAULT_WORKERS_AI_MODEL, getWorkersAIModel } from "./helpers";
import { truncate } from "./helpers";

export type DashboardBriefingPayload = {
  text: string;
  date: string;
  cached: boolean;
  context: {
    unreadEmails: number;
    tasksDueToday: number;
    overdueTasks: number;
    peopleNotContacted7d: number;
  };
};

function formatDateUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function getDayBoundsUtc(now: number): { start: number; end: number } {
  const today = formatDateUtc(now);
  const start = new Date(`${today}T00:00:00.000Z`).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

function buildFallbackBriefingSentence(input: {
  unreadCount: number;
  dueTodayCount: number;
  overdueCount: number;
  stalePeopleCount: number;
}): string {
  return `You have ${input.unreadCount} unread email${input.unreadCount === 1 ? "" : "s"}, ${input.dueTodayCount} task${input.dueTodayCount === 1 ? "" : "s"} due today, ${input.overdueCount} overdue task${input.overdueCount === 1 ? "" : "s"}, and ${input.stalePeopleCount} contact${input.stalePeopleCount === 1 ? "" : "s"} not reached in over a week.`;
}

export async function buildDashboardBriefingPayload(input: {
  db: Database;
  env: Env;
  userId: string;
}) {
  const db = input.db;
  const { env, userId } = input;
  const now = Date.now();
  const today = formatDateUtc(now);
  const staleThreshold = now - 7 * 24 * 60 * 60 * 1000;
  const { start: dayStart, end: dayEnd } = getDayBoundsUtc(now);

  const existing = await db
    .select({
      narrative: dailyBriefings.narrative,
      unreadCount: dailyBriefings.unreadCount,
      tasksDueCount: dailyBriefings.tasksDueCount,
      overdueCount: dailyBriefings.overdueCount,
      followUpCount: dailyBriefings.followUpCount,
      date: dailyBriefings.date,
    })
    .from(dailyBriefings)
    .where(and(eq(dailyBriefings.userId, userId), eq(dailyBriefings.date, today)))
    .limit(1);

  const cached = existing[0];
  if (cached?.narrative) {
    return {
      text: cached.narrative,
      date: cached.date,
      cached: true,
      context: {
        unreadEmails: cached.unreadCount ?? 0,
        tasksDueToday: cached.tasksDueCount ?? 0,
        overdueTasks: cached.overdueCount ?? 0,
        peopleNotContacted7d: cached.followUpCount ?? 0,
      },
    } satisfies DashboardBriefingPayload;
  }

  const [unreadCountRows, dueTodayRows, overdueRows, stalePeopleRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.isRead, false))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          gte(tasks.dueAt, dayStart),
          lte(tasks.dueAt, dayEnd),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.done, false), lt(tasks.dueAt, now))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(people)
      .where(and(eq(people.userId, userId), lt(people.lastContactedAt, staleThreshold))),
  ]);

  const unreadCount = Number(unreadCountRows[0]?.count ?? 0);
  const dueTodayCount = Number(dueTodayRows[0]?.count ?? 0);
  const overdueCount = Number(overdueRows[0]?.count ?? 0);
  const stalePeopleCount = Number(stalePeopleRows[0]?.count ?? 0);

  const basePrompt = [
    "You are an assistant generating one daily CRM briefing sentence.",
    "Write exactly one natural sentence in plain language.",
    "Include all key counts and prioritize urgency.",
    "Do not use bullets, labels, markdown, or extra lines.",
  ].join(" ");

  const prompt = [
    `Unread emails: ${unreadCount}`,
    `Tasks due today: ${dueTodayCount}`,
    `Overdue tasks: ${overdueCount}`,
    `People not contacted in 7+ days: ${stalePeopleCount}`,
  ].join("\n");

  const fallbackText = buildFallbackBriefingSentence({
    unreadCount,
    dueTodayCount,
    overdueCount,
    stalePeopleCount,
  });

  let text = fallbackText;
  try {
    const result = await generateText({
      model: getWorkersAIModel(env),
      system: buildSystemPrompt(basePrompt, null),
      prompt,
      maxOutputTokens: 100,
    });

    const normalized = truncate((result.text ?? "").trim(), 300);
    if (normalized.length > 0) {
      text = normalized;
    }
  } catch (error) {
    const aiError = getAiErrorDetails(error);
    console.error("Daily briefing generation failed, using fallback", {
      userId,
      route: "/api/dashboard/briefing",
      model: DEFAULT_WORKERS_AI_MODEL,
      aiError,
      context: { unreadCount, dueTodayCount, overdueCount, stalePeopleCount },
    });
  }

  await db
    .insert(dailyBriefings)
    .values({
      userId,
      date: today,
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

  return {
    text,
    date: today,
    cached: false,
    context: {
      unreadEmails: unreadCount,
      tasksDueToday: dueTodayCount,
      overdueTasks: overdueCount,
      peopleNotContacted7d: stalePeopleCount,
    },
  } satisfies DashboardBriefingPayload;
}
