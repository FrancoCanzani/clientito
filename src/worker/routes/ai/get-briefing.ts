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
  emailIntelligence,
  emails,
  tasks,
} from "../../db/schema";
import { listEvents } from "../../lib/calendar/google";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import {
  getStoredEmailTriage,
} from "../../lib/email/intelligence/store";
import { getStoredReplyDraft } from "../../lib/email/intelligence/common";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { STANDARD_LABELS } from "../../lib/email/types";
import type { AppRouteEnv } from "../types";
import { hasEmailLabel } from "../inbox/emails/utils";
import { getDayBoundsUtc } from "../../lib/utils";

const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_FALLBACK_ITEMS = 3;

type BriefingItem = {
  id: string;
  type:
    | "email_action"
    | "briefing_email"
    | "overdue_task"
    | "due_today_task"
    | "calendar_suggestion"
    | "calendar_event";
  title: string;
  reason: string;
  href: string;
  emailId?: number;
  actionId?: string;
  actionType?: string;
  draftReply?: string | null;
  threadId?: string | null;
  fromAddr?: string;
  fromName?: string | null;
  subject?: string | null;
  mailboxId?: number | null;
  messageId?: string | null;
  proposedEventId?: number;
  eventStart?: number;
  eventEnd?: number;
  eventLocation?: string | null;
  eventDescription?: string | null;
  urgency?: "high" | "medium" | "low";
  taskTitle?: string | null;
  taskDueAt?: number | null;
  taskPriority?: "urgent" | "high" | "medium" | "low" | null;
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

function buildEmailReason(reason: string | null, fallback: string) {
  return reason?.trim() || fallback;
}

function shouldSurfaceBriefingEmail(intelligence: NonNullable<ReturnType<typeof getStoredEmailTriage>>) {
  return (
    (intelligence.category === "action_needed" ||
      intelligence.category === "important" ||
      intelligence.category === "notification") &&
    intelligence.urgency !== "low" &&
    Boolean(intelligence.briefingSentence?.trim())
  );
}

function shouldSurfaceReplyAction(input: {
  intelligence: NonNullable<ReturnType<typeof getStoredEmailTriage>>;
  action: NonNullable<ReturnType<typeof getStoredEmailTriage>>["actions"][number];
  draftReply: string | null;
}) {
  return (
    input.action.status === "pending" &&
    input.action.trustLevel === "approve" &&
    input.action.type === "reply" &&
    Boolean(input.draftReply) &&
    (input.intelligence.category === "action_needed" ||
      input.intelligence.category === "important")
  );
}

function shouldSurfaceCreateTaskAction(
  action: NonNullable<ReturnType<typeof getStoredEmailTriage>>["actions"][number],
) {
  return (
    action.status === "pending" &&
    action.type === "create_task" &&
    Boolean(action.payload?.taskTitle?.trim())
  );
}

function buildTaskReason(task: { dueAt: number | null }, type: "overdue_task" | "due_today_task") {
  if (!task.dueAt) {
    return type === "overdue_task" ? "This task needs a new date." : "Scheduled for today.";
  }
  const age = formatDistanceToNowStrict(new Date(task.dueAt), { addSuffix: true });
  return type === "overdue_task" ? `It slipped ${age}.` : `Due ${age}.`;
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
        isRead: emails.isRead,
        messageId: emails.messageId,
        mailboxId: emails.mailboxId,
        intelligenceStatus: emailIntelligence.status,
        intelligenceCategory: emailIntelligence.category,
        intelligenceUrgency: emailIntelligence.urgency,
        intelligenceBriefingSentence: emailIntelligence.briefingSentence,
        intelligenceSuspiciousJson: emailIntelligence.suspiciousJson,
        intelligenceActionsJson: emailIntelligence.actionsJson,
        intelligenceCalendarEventsJson: emailIntelligence.calendarEventsJson,
      })
      .from(emails)
      .innerJoin(
        latestThreadDates,
        and(
          eq(emails.threadId, latestThreadDates.threadId),
          eq(emails.date, latestThreadDates.latestDate),
        ),
      )
      .leftJoin(emailIntelligence, eq(emailIntelligence.emailId, emails.id))
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
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt })
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
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), ne(tasks.status, "done"), lt(tasks.dueAt, now)))
      .orderBy(tasks.dueAt)
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

  const calendarEvents: {
    title: string;
    startAt: number;
    endAt: number;
    location?: string;
    isAllDay: boolean;
  }[] = [];

  try {
    const allMailboxes = await getUserMailboxes(input.db, input.userId);
    const dayStartIso = new Date(dayStart).toISOString();
    const dayEndIso = new Date(dayEnd).toISOString();
    for (const mailbox of allMailboxes) {
      if (!mailbox.historyId || mailbox.authState !== "ok") continue;
      try {
        const token = await getGmailTokenForMailbox(input.db, mailbox.id, {
          GOOGLE_CLIENT_ID: input.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: input.env.GOOGLE_CLIENT_SECRET,
        });
        const events = await listEvents(token, dayStartIso, dayEndIso);
        for (const event of events) {
          const isAllDay = !event.start.dateTime;
          calendarEvents.push({
            title: event.summary || "(No title)",
            startAt: isAllDay
              ? new Date(event.start.date!).getTime()
              : new Date(event.start.dateTime!).getTime(),
            endAt: isAllDay
              ? new Date(event.end.date!).getTime()
              : new Date(event.end.dateTime!).getTime(),
            location: event.location,
            isAllDay,
          });
        }
      } catch (error) {
        console.error("Briefing: failed to fetch calendar events", {
          mailboxId: mailbox.id,
          error,
        });
      }
    }
    calendarEvents.sort((left, right) => left.startAt - right.startAt);
  } catch (error) {
    console.error("Briefing: calendar fetch failed", { error });
  }

  const decidedTasks = new Set<number>();
  for (const row of decisionRows) {
    if (row.itemType === "task" && row.decision !== "pending") {
      decidedTasks.add(row.referenceId);
    }
  }

  const emailActionItems: BriefingItem[] = [];
  const briefingEmailItems: BriefingItem[] = [];
  const calendarSuggestionItems: BriefingItem[] = [];
  const emailIdsWithActions = new Set<number>();
  let fallbackCount = 0;

  for (const row of latestThreadRows) {
    if (row.direction !== "received") continue;
    if (now - row.date > REPLY_WINDOW_MS) continue;

    const intelligence = getStoredEmailTriage({
      status: row.intelligenceStatus ?? "pending",
      category: row.intelligenceCategory,
      urgency: row.intelligenceUrgency,
      briefingSentence: row.intelligenceBriefingSentence,
      suspiciousJson: row.intelligenceSuspiciousJson ?? {
        isSuspicious: false,
        kind: null,
        reason: null,
        confidence: null,
      },
      actionsJson: row.intelligenceActionsJson ?? [],
      calendarEventsJson: row.intelligenceCalendarEventsJson ?? [],
    });

    if (!intelligence) {
      // Surface recent unread emails that haven't been analyzed yet as fallbacks,
      // so nothing silently disappears from the briefing while triage is pending or failed.
      if (
        !row.isRead &&
        now - row.date < FALLBACK_WINDOW_MS &&
        fallbackCount < MAX_FALLBACK_ITEMS
      ) {
        briefingEmailItems.push({
          id: `briefing-email-${row.id}`,
          type: "briefing_email",
          title: getSenderLabel(row),
          reason: row.subject?.trim() || "New message",
          href: `/inbox/all/email/${row.id}`,
          emailId: row.id,
          threadId: row.threadId,
          fromAddr: row.fromAddr,
          fromName: row.fromName,
          subject: row.subject,
          mailboxId: row.mailboxId,
          messageId: row.messageId,
        });
        fallbackCount++;
      }
      continue;
    }

    for (const action of intelligence.actions) {
      if (shouldSurfaceCreateTaskAction(action)) {
        emailActionItems.push({
          id: `email-action-${row.id}-${action.id}`,
          type: "email_action",
          title: getSenderLabel(row),
          reason: buildEmailReason(intelligence.briefingSentence, action.label),
          href: `/inbox/all/email/${row.id}`,
          emailId: row.id,
          actionId: action.id,
          actionType: "create_task",
          threadId: row.threadId,
          fromAddr: row.fromAddr,
          fromName: row.fromName,
          subject: row.subject,
          mailboxId: row.mailboxId,
          messageId: row.messageId,
          urgency: intelligence.urgency,
          taskTitle: action.payload?.taskTitle ?? null,
          taskDueAt: (action.payload?.taskDueAt as number | null) ?? null,
          taskPriority: action.payload?.taskPriority ?? null,
        });
        emailIdsWithActions.add(row.id);
        continue;
      }

      const draftReply = getStoredReplyDraft({
        ...intelligence,
        actions: [action],
      });

      if (
        !shouldSurfaceReplyAction({
          intelligence,
          action,
          draftReply,
        })
      ) {
        continue;
      }

      emailActionItems.push({
        id: `email-action-${row.id}-${action.id}`,
        type: "email_action",
        title: getSenderLabel(row),
        reason: buildEmailReason(intelligence.briefingSentence, action.label),
        href: `/inbox/all/email/${row.id}`,
        emailId: row.id,
        actionId: action.id,
        actionType: action.type,
        draftReply,
        threadId: row.threadId,
        fromAddr: row.fromAddr,
        fromName: row.fromName,
        subject: row.subject,
        mailboxId: row.mailboxId,
        messageId: row.messageId,
        urgency: intelligence.urgency,
      });
      emailIdsWithActions.add(row.id);
    }

    if (!emailIdsWithActions.has(row.id) && shouldSurfaceBriefingEmail(intelligence)) {
      briefingEmailItems.push({
        id: `briefing-email-${row.id}`,
        type: "briefing_email",
        title: getSenderLabel(row),
        reason: intelligence.briefingSentence ?? "",
        href: `/inbox/all/email/${row.id}`,
        emailId: row.id,
        threadId: row.threadId,
        fromAddr: row.fromAddr,
        fromName: row.fromName,
        subject: row.subject,
        mailboxId: row.mailboxId,
        messageId: row.messageId,
        urgency: intelligence.urgency,
      });
    }

    for (const suggestion of intelligence.calendarEvents) {
      if (suggestion.status !== "pending") continue;
      calendarSuggestionItems.push({
        id: `calendar-suggestion-${suggestion.id}`,
        type: "calendar_suggestion",
        title: suggestion.title,
        reason: buildEmailReason(intelligence.briefingSentence, suggestion.sourceText),
        href: `/inbox/all/email/${row.id}`,
        emailId: row.id,
        fromName: row.fromName,
        proposedEventId: suggestion.id,
        eventStart: suggestion.startAt,
        eventEnd: suggestion.endAt,
        eventLocation: suggestion.location,
        eventDescription: suggestion.sourceText,
      });
    }
  }

  const dueTodayCount = Number(dueTodayCountRows[0]?.count ?? 0);
  const overdueCount = Number(overdueCountRows[0]?.count ?? 0);

  const items: BriefingItem[] = [
    ...emailActionItems,
    ...briefingEmailItems,
    ...overdueTaskRows
      .filter((task) => !decidedTasks.has(task.id))
      .map((task) => ({
        id: `overdue-${task.id}`,
        type: "overdue_task" as const,
        title: task.title,
        reason: buildTaskReason(task, "overdue_task"),
        href: "/tasks",
      })),
    ...dueTodayTaskRows
      .filter((task) => !decidedTasks.has(task.id))
      .map((task) => ({
        id: `today-${task.id}`,
        type: "due_today_task" as const,
        title: task.title,
        reason: buildTaskReason(task, "due_today_task"),
        href: "/tasks",
      })),
    ...calendarSuggestionItems,
    ...calendarEvents.map((event, index) => ({
      id: `calendar-${index}`,
      type: "calendar_event" as const,
      title: event.title,
      reason: event.isAllDay
        ? "All day"
        : `${new Date(event.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${new Date(event.endAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      href: "/agenda",
      eventStart: event.startAt,
      eventEnd: event.endAt,
      eventLocation: event.location,
    })),
  ];

  return {
    text: "",
    generatedAt: now,
    counts: {
      actionNeeded: emailActionItems.length,
      dueToday: dueTodayCount,
      overdue: overdueCount,
    },
    items,
  };
}

const STREAM_SYSTEM = [
  "You are a discreet, highly competent secretary writing a daily briefing.",
  "Write a concise summary in 2-4 sentences as a single flowing paragraph.",
  "Weave the relevant items naturally into the text, including calendar events for today.",
  "Prioritize items by urgency — mention time-sensitive items first.",
  "For each item, use the EXACT link syntax [[title|href]] provided.",
  "No markdown, no bullets, no headings.",
  "If there are no items, write a short sentence saying everything looks clear.",
].join(" ");

function buildStreamPrompt(
  items: BriefingItem[],
  counts: { actionNeeded: number; dueToday: number; overdue: number },
) {
  const lines = items.map((item) => {
    const label =
      item.type === "email_action"
        ? "email action"
        : item.type === "briefing_email"
          ? "email"
          : item.type === "overdue_task"
            ? "overdue task"
            : item.type === "calendar_suggestion"
              ? "calendar suggestion"
              : item.type === "calendar_event"
                ? "calendar event"
                : "due today task";
    return `- ${label}: title="${item.title}", reason="${item.reason}", link=[[${item.title}|${item.href}]]`;
  });

  return [
    `Action-needed: ${counts.actionNeeded}, Overdue tasks: ${counts.overdue}, Due today: ${counts.dueToday}, Calendar events: ${items.filter((item) => item.type === "calendar_event").length}`,
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
        maxOutputTokens: 400,
      });

      return result.toTextStreamResponse({
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("Briefing stream failed", { userId: user.id, error });
      return new Response("Your email and tasks look under control.", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  });
}
