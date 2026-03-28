import type { Hono } from "hono";
import { streamText } from "ai";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  ne,
  not,
  sql,
} from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { formatDistanceToNowStrict } from "date-fns";
import { PRIMARY_MODEL } from "../../lib/constants";
import {
  briefingDecisions,
  emails,
  proposedEvents,
  tasks,
} from "../../db/schema";
import { listEvents } from "../../lib/calendar/google";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { STANDARD_LABELS } from "../../lib/email/types";
import type { AppRouteEnv } from "../types";
import { hasEmailLabel } from "../inbox/emails/utils";
import { getDayBoundsUtc } from "../../lib/utils";

const REPLY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type BriefingItem = {
  id: string;
  type:
    | "action_needed"
    | "important"
    | "overdue_task"
    | "due_today_task"
    | "proposed_event"
    | "calendar_event";
  title: string;
  reason: string;
  href: string;
  emailId?: number;
  draftReply?: string | null;
  threadId?: string | null;
  fromAddr?: string;
  subject?: string | null;
  mailboxId?: number | null;
  messageId?: string | null;
  proposedEventId?: number;
  eventStart?: number;
  eventEnd?: number;
  eventLocation?: string | null;
  eventDescription?: string | null;
};

type BriefingData = {
  text: string;
  generatedAt: number;
  counts: {
    actionNeeded: number;
    dueToday: number;
    overdue: number;
  };
  items: BriefingItem[];
};

function getTodayBounds(now: number) {
  const { start, end } = getDayBoundsUtc(now);
  return { start, end };
}

function getSenderLabel(row: { fromName: string | null; fromAddr: string }) {
  return row.fromName?.trim() || row.fromAddr;
}

function buildReplyReason(row: { subject: string | null; date: number }) {
  const age = formatDistanceToNowStrict(new Date(row.date), { addSuffix: true });
  if (row.subject?.trim()) return `${row.subject.trim()} came in ${age}.`;
  return `Latest inbound message was ${age}.`;
}

function buildTaskReason(task: { dueAt: number | null }, type: "overdue_task" | "due_today_task") {
  if (!task.dueAt) {
    return type === "overdue_task" ? "This task needs a new date." : "Scheduled for today.";
  }
  const age = formatDistanceToNowStrict(new Date(task.dueAt), { addSuffix: true });
  return type === "overdue_task" ? `It slipped ${age}.` : `Due ${age}.`;
}

function buildProposedEventReason(startAt: number) {
  const d = new Date(startAt);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `Extracted from email — ${day} at ${time}`;
}

export async function buildBriefing(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
}): Promise<BriefingData> {
  const now = Date.now();
  const { start: dayStart, end: dayEnd } = getTodayBounds(now);

  const latestThreadDates = input.db
    .select({
      threadId: emails.threadId,
      latestDate: sql<number>`max(${emails.date})`.as("latest_date"),
    })
    .from(emails)
    .where(
      and(
        eq(emails.userId, input.userId),
        isNotNull(emails.threadId),
        not(hasEmailLabel(STANDARD_LABELS.TRASH)),
        not(hasEmailLabel(STANDARD_LABELS.SPAM)),
      ),
    )
    .groupBy(emails.threadId)
    .as("latest_thread_dates");

  const [
    latestThreadRows,
    dueTodayCountRows,
    overdueCountRows,
    dueTodayTaskRows,
    overdueTaskRows,
    pendingProposedEvents,
    decisionRows,
  ] = await Promise.all([
    input.db
      .select({
        id: emails.id,
        threadId: emails.threadId,
        date: emails.date,
        direction: emails.direction,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        subject: emails.subject,
        snippet: emails.snippet,
        isRead: emails.isRead,
        aiLabel: emails.aiLabel,
        draftReply: emails.draftReply,
        messageId: emails.messageId,
        mailboxId: emails.mailboxId,
      })
      .from(emails)
      .innerJoin(
        latestThreadDates,
        and(
          eq(emails.threadId, latestThreadDates.threadId),
          eq(emails.date, latestThreadDates.latestDate),
        ),
      )
      .where(eq(emails.userId, input.userId))
      .orderBy(desc(emails.date)),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, input.userId),
          ne(tasks.status, "done"),
          gte(tasks.dueAt, dayStart),
          lt(tasks.dueAt, dayEnd),
        ),
      ),
    input.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), ne(tasks.status, "done"), lt(tasks.dueAt, now))),
    input.db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, priority: tasks.priority })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, input.userId),
          ne(tasks.status, "done"),
          gte(tasks.dueAt, dayStart),
          lt(tasks.dueAt, dayEnd),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(5),
    input.db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, priority: tasks.priority })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), ne(tasks.status, "done"), lt(tasks.dueAt, now)))
      .orderBy(tasks.dueAt)
      .limit(5),
    input.db
      .select({
        id: proposedEvents.id,
        emailId: proposedEvents.emailId,
        title: proposedEvents.title,
        description: proposedEvents.description,
        location: proposedEvents.location,
        startAt: proposedEvents.startAt,
        endAt: proposedEvents.endAt,
      })
      .from(proposedEvents)
      .where(
        and(
          eq(proposedEvents.userId, input.userId),
          eq(proposedEvents.status, "pending"),
        ),
      )
      .orderBy(proposedEvents.startAt)
      .limit(5),
    input.db
      .select({
        itemType: briefingDecisions.itemType,
        referenceId: briefingDecisions.referenceId,
        decision: briefingDecisions.decision,
      })
      .from(briefingDecisions)
      .where(eq(briefingDecisions.userId, input.userId)),
  ]);

  // Calendar events
  const calendarEvents: { title: string; startAt: number; endAt: number; location?: string; isAllDay: boolean; htmlLink?: string }[] = [];
  try {
    const allMailboxes = await getUserMailboxes(input.db, input.userId);
    const dayStartIso = new Date(dayStart).toISOString();
    const dayEndIso = new Date(dayEnd).toISOString();
    for (const mb of allMailboxes) {
      if (!mb.historyId || mb.authState !== "ok") continue;
      try {
        const token = await getGmailTokenForMailbox(input.db, mb.id, {
          GOOGLE_CLIENT_ID: input.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: input.env.GOOGLE_CLIENT_SECRET,
        });
        const events = await listEvents(token, dayStartIso, dayEndIso);
        for (const e of events) {
          const isAllDay = !e.start.dateTime;
          calendarEvents.push({
            title: e.summary || "(No title)",
            startAt: isAllDay ? new Date(e.start.date!).getTime() : new Date(e.start.dateTime!).getTime(),
            endAt: isAllDay ? new Date(e.end.date!).getTime() : new Date(e.end.dateTime!).getTime(),
            location: e.location,
            isAllDay,
            htmlLink: e.htmlLink,
          });
        }
      } catch (error) {
        console.error("Briefing: failed to fetch calendar events", { mailboxId: mb.id, error });
      }
    }
    calendarEvents.sort((a, b) => a.startAt - b.startAt);
  } catch (error) {
    console.error("Briefing: calendar fetch failed", { error });
  }

  // Decisions map
  const decided = new Set<string>();
  for (const row of decisionRows) {
    if (row.decision !== "pending") {
      decided.add(`${row.itemType}:${row.referenceId}`);
    }
  }

  // Deduplicate threads, keep latest per thread
  const latestByThread = new Map<string, (typeof latestThreadRows)[0]>();
  for (const row of latestThreadRows) {
    if (!row.threadId || latestByThread.has(row.threadId)) continue;
    latestByThread.set(row.threadId, row);
  }

  // Trust the AI classifier labels — just filter by label + recency
  const actionNeededThreads = [...latestByThread.values()]
    .filter((row) => row.direction === "received")
    .filter((row) => row.aiLabel === "action_needed")
    .filter((row) => now - row.date <= REPLY_WINDOW_MS)
    .filter((row) => !decided.has(`email:${row.id}`));

  const importantThreads = [...latestByThread.values()]
    .filter((row) => row.direction === "received")
    .filter((row) => row.aiLabel === "important" || row.aiLabel === "later")
    .filter((row) => now - row.date <= REPLY_WINDOW_MS)
    .filter((row) => !decided.has(`email:${row.id}`))
    .slice(0, 5);

  const dueTodayCount = Number(dueTodayCountRows[0]?.count ?? 0);
  const overdueCount = Number(overdueCountRows[0]?.count ?? 0);

  const items: BriefingItem[] = [
    ...actionNeededThreads.map((row) => ({
      id: `action-needed-${row.id}`,
      type: "action_needed" as const,
      title: getSenderLabel(row),
      reason: buildReplyReason(row),
      href: `/inbox/all/email/${row.id}`,
      emailId: row.id,
      draftReply: row.draftReply,
      threadId: row.threadId,
      fromAddr: row.fromAddr,
      subject: row.subject,
      mailboxId: row.mailboxId,
      messageId: row.messageId,
    })),
    ...importantThreads.map((row) => ({
      id: `important-${row.id}`,
      type: "important" as const,
      title: getSenderLabel(row),
      reason: buildReplyReason(row),
      href: `/inbox/all/email/${row.id}`,
      emailId: row.id,
      threadId: row.threadId,
      fromAddr: row.fromAddr,
      subject: row.subject,
      mailboxId: row.mailboxId,
      messageId: row.messageId,
    })),
    ...overdueTaskRows
      .filter((t) => !decided.has(`task:${t.id}`))
      .map((task) => ({
        id: `overdue-${task.id}`,
        type: "overdue_task" as const,
        title: task.title,
        reason: buildTaskReason(task, "overdue_task"),
        href: "/tasks",
      })),
    ...dueTodayTaskRows
      .filter((t) => !decided.has(`task:${t.id}`))
      .map((task) => ({
        id: `today-${task.id}`,
        type: "due_today_task" as const,
        title: task.title,
        reason: buildTaskReason(task, "due_today_task"),
        href: "/tasks",
      })),
    ...pendingProposedEvents
      .filter((pe) => !decided.has(`proposed_event:${pe.id}`))
      .map((pe) => ({
        id: `proposed-event-${pe.id}`,
        type: "proposed_event" as const,
        title: pe.title,
        reason: buildProposedEventReason(pe.startAt),
        href: pe.emailId ? `/inbox/all/email/${pe.emailId}` : "/calendar",
        proposedEventId: pe.id,
        eventStart: pe.startAt,
        eventEnd: pe.endAt,
        eventLocation: pe.location,
        eventDescription: pe.description,
      })),
    ...calendarEvents.map((ce, i) => ({
      id: `calendar-${i}`,
      type: "calendar_event" as const,
      title: ce.title,
      reason: ce.isAllDay
        ? "All day"
        : `${new Date(ce.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${new Date(ce.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      href: "/agenda",
      eventStart: ce.startAt,
      eventEnd: ce.endAt,
      eventLocation: ce.location,
    })),
  ];

  return {
    text: "",
    generatedAt: now,
    counts: {
      actionNeeded: actionNeededThreads.length,
      dueToday: dueTodayCount,
      overdue: overdueCount,
    },
    items,
  };
}

const STREAM_SYSTEM = [
  "You are a discreet, highly competent secretary writing a daily briefing as a single flowing paragraph.",
  "Weave the relevant items naturally into the text, including calendar events for today.",
  "If an item is obviously promotional, newsletter-like, or non-actionable, leave it out.",
  "For each item, use the EXACT link syntax [[title|href]] provided — do not change the title or href.",
  "CRITICAL: Always keep a space before and after each [[...]] link.",
  "Write 1-2 concise sentences. Keep it short and smooth.",
  "Do not instruct the user or imply urgency beyond the facts.",
  "Avoid words like should, need to, please, important, urgent.",
  "No markdown, no bullet points. Just a natural paragraph with [[links]] inline.",
  "If there are no items, write a short sentence saying everything looks clear.",
].join(" ");

function buildStreamPrompt(items: BriefingItem[], counts: { actionNeeded: number; dueToday: number; overdue: number }) {
  const lines = items.map((item) => {
    const label =
      item.type === "action_needed" ? "action needed" :
      item.type === "important" ? "important" :
      item.type === "overdue_task" ? "overdue task" :
      item.type === "proposed_event" ? "proposed event" :
      item.type === "calendar_event" ? "calendar event" :
      "due today";
    return `- ${label}: title="${item.title}", reason="${item.reason}", link=[[${item.title}|${item.href}]]`;
  });

  return [
    `Action-needed: ${counts.actionNeeded}, Overdue tasks: ${counts.overdue}, Due today: ${counts.dueToday}, Calendar events: ${items.filter((i) => i.type === "calendar_event").length}`,
    "",
    "Items:",
    ...lines,
  ].join("\n");
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
    const env = c.env;

    const briefing = await buildBriefing({ db, env, userId: user.id });

    try {
      const workersAI = createWorkersAI({ binding: env.AI });
      const result = streamText({
        model: workersAI(PRIMARY_MODEL),
        system: STREAM_SYSTEM,
        prompt: buildStreamPrompt(briefing.items, briefing.counts),
        maxOutputTokens: 250,
      });

      return result.toTextStreamResponse({
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("Briefing stream failed", { userId: user.id, error });
      return new Response("Your email and tasks look under control.", {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  });
}
