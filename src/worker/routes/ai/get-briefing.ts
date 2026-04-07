import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { emails, tasks } from "../../db/schema";
import { listEvents } from "../../lib/calendar/google";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import type { AppRouteEnv } from "../types";
import { getDayBoundsUtc } from "../../lib/utils";
import { z } from "zod";

type BriefingTask = {
  title: string;
  dueAt: number | null;
  type: "overdue" | "due_today";
};

type BriefingEvent = {
  title: string;
  startAt: number;
  endAt: number;
  isAllDay: boolean;
  location?: string;
};

type BriefingContext = {
  tasks: BriefingTask[];
  events: BriefingEvent[];
};

async function buildBriefingContext(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
  mailboxId: number;
}): Promise<BriefingContext> {
  const now = Date.now();
  const { start: dayStart, end: dayEnd } = getDayBoundsUtc(now);

  const [dueTodayRows, overdueRows] = await Promise.all([
    input.db
      .select({ title: tasks.title, dueAt: tasks.dueAt })
      .from(tasks)
      .innerJoin(emails, eq(tasks.sourceEmailId, emails.id))
      .where(
        and(
          eq(tasks.userId, input.userId),
          ne(tasks.status, "done"),
          gte(tasks.dueAt, dayStart),
          lt(tasks.dueAt, dayEnd),
          eq(emails.mailboxId, input.mailboxId),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(10),
    input.db
      .select({ title: tasks.title, dueAt: tasks.dueAt })
      .from(tasks)
      .innerJoin(emails, eq(tasks.sourceEmailId, emails.id))
      .where(
        and(
          eq(tasks.userId, input.userId),
          ne(tasks.status, "done"),
          lt(tasks.dueAt, dayStart),
          eq(emails.mailboxId, input.mailboxId),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(5),
  ]);

  const briefingTasks: BriefingTask[] = [
    ...overdueRows.map((t) => ({ title: t.title, dueAt: t.dueAt, type: "overdue" as const })),
    ...dueTodayRows.map((t) => ({ title: t.title, dueAt: t.dueAt, type: "due_today" as const })),
  ];

  const events: BriefingEvent[] = [];

  try {
    const allMailboxes = await getUserMailboxes(input.db, input.userId);
    const mailbox = allMailboxes.find((m) => m.id === input.mailboxId);
    if (mailbox?.historyId && mailbox.authState === "ok") {
      const token = await getGmailTokenForMailbox(input.db, input.mailboxId, {
        GOOGLE_CLIENT_ID: input.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: input.env.GOOGLE_CLIENT_SECRET,
      });
      const calendarEvents = await listEvents(
        token,
        new Date(dayStart).toISOString(),
        new Date(dayEnd).toISOString(),
      );
      for (const event of calendarEvents) {
        const isAllDay = !event.start.dateTime;
        events.push({
          title: event.summary || "(No title)",
          startAt: isAllDay
            ? new Date(event.start.date!).getTime()
            : new Date(event.start.dateTime!).getTime(),
          endAt: isAllDay
            ? new Date(event.end.date!).getTime()
            : new Date(event.end.dateTime!).getTime(),
          isAllDay,
          location: event.location,
        });
      }
      events.sort((a, b) => a.startAt - b.startAt);
    }
  } catch (error) {
    console.error("Briefing: calendar fetch failed", { error });
  }

  return { tasks: briefingTasks, events };
}

const briefingStreamSchema = z.object({
  mailboxId: z.number().int().positive(),
});

const STREAM_SYSTEM = [
  "You are a discreet, highly competent secretary writing a morning briefing.",
  "Write 2-4 sentences as a single flowing paragraph.",
  "Mention today's calendar events and any overdue or due-today tasks by name.",
  "Be specific: include times, task titles, and any relevant details.",
  "No markdown, no bullets, no headings.",
  "If there are no tasks or events, write a short sentence saying everything looks clear.",
].join(" ");

function buildStreamPrompt(context: BriefingContext): string {
  const lines: string[] = [];

  if (context.events.length > 0) {
    lines.push("Today's calendar:");
    for (const event of context.events) {
      const time = event.isAllDay
        ? "all day"
        : new Date(event.startAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
      lines.push(`- ${event.title} at ${time}${event.location ? ` (${event.location})` : ""}`);
    }
  }

  if (context.tasks.length > 0) {
    lines.push("Tasks:");
    for (const task of context.tasks) {
      lines.push(`- [${task.type === "overdue" ? "OVERDUE" : "DUE TODAY"}] ${task.title}`);
    }
  }

  if (lines.length === 0) {
    return "No tasks or events today.";
  }

  return lines.join("\n");
}

function buildFallbackBriefing(context: BriefingContext): string {
  if (context.events.length === 0 && context.tasks.length === 0) {
    return "Your day looks clear with no events or pending tasks right now.";
  }

  const parts: string[] = [];

  if (context.events.length > 0) {
    const eventSummary = context.events
      .slice(0, 3)
      .map((event) => {
        const time = event.isAllDay
          ? "all day"
          : new Date(event.startAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
        return `${event.title} (${time})`;
      })
      .join(", ");
    parts.push(`Today's calendar includes ${eventSummary}.`);
  }

  const overdue = context.tasks.filter((task) => task.type === "overdue");
  const dueToday = context.tasks.filter((task) => task.type === "due_today");

  if (overdue.length > 0) {
    parts.push(`You have ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} starting with ${overdue[0]!.title}.`);
  }

  if (dueToday.length > 0) {
    parts.push(`You also have ${dueToday.length} task${dueToday.length === 1 ? "" : "s"} due today, including ${dueToday[0]!.title}.`);
  }

  return parts.join(" ");
}

export function registerPostBriefingStream(app: Hono<AppRouteEnv>) {
  app.post("/briefing/stream", zValidator("json", briefingStreamSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;
    const { mailboxId } = c.req.valid("json");

    const context = await buildBriefingContext({
      db,
      env,
      userId: user.id,
      mailboxId,
    });

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    const prompt = buildStreamPrompt(context);

    try {
      const result = await generateText({
        model: openai.responses("gpt-5.4-mini"),
        system: STREAM_SYSTEM,
        prompt,
        maxOutputTokens: 300,
      });
      const text = result.text.trim();
      if (text) {
        return new Response(text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      return new Response(buildFallbackBriefing(context), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("Briefing stream failed", { userId: user.id, error });
      return new Response(buildFallbackBriefing(context), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  });
}

export { buildBriefingContext };
