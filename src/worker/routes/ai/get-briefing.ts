import type { Hono } from "hono";
import { generateText, streamText } from "ai";
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
import { dailyBriefings, emails, tasks } from "../../db/schema";
import { isAutomatedSender, isPublicDomain } from "../../lib/domains";
import { STANDARD_LABELS } from "../../lib/email/types";
import type { AppRouteEnv } from "../types";
import { hasEmailLabel } from "../inbox/emails/utils";
import { getDayBoundsUtc } from "../../lib/utils";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const BRIEFING_TTL_MS = 10 * 60 * 1000;
const ACTIONABLE_REPLY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function getTodayBounds(now: number): { day: string; start: number; end: number } {
  const { start, end } = getDayBoundsUtc(now);
  const day = new Date(now).toISOString().slice(0, 10);
  return { day, start, end };
}

function buildFallbackText(input: {
  needsReplyCount: number;
  dueTodayCount: number;
  overdueCount: number;
}): string {
  if (input.needsReplyCount > 0 && input.overdueCount > 0) {
    return `${input.needsReplyCount} conversation${input.needsReplyCount === 1 ? "" : "s"} are waiting on your reply, and ${input.overdueCount} task${input.overdueCount === 1 ? " is" : "s are"} overdue.`;
  }

  if (input.needsReplyCount > 0) {
    return `${input.needsReplyCount} recent conversation${input.needsReplyCount === 1 ? " is" : "s are"} waiting on your reply.`;
  }

  if (input.overdueCount > 0) {
    return `${input.overdueCount} task${input.overdueCount === 1 ? " is" : "s are"} overdue, and ${input.dueTodayCount} ${input.dueTodayCount === 1 ? "task is" : "tasks are"} due today.`;
  }

  if (input.dueTodayCount > 0) {
    return `${input.dueTodayCount} ${input.dueTodayCount === 1 ? "task is" : "tasks are"} due today.`;
  }

  return "Your replies and tasks look under control.";
}

type BriefingItem = {
  id: string;
  type: "reply" | "fyi" | "overdue_task" | "due_today_task";
  title: string;
  reason: string;
  href: string;
};

type BriefingData = {
  text: string;
  generatedAt: number;
  counts: {
    needsReply: number;
    dueToday: number;
    overdue: number;
  };
  items: BriefingItem[];
};

type LatestThreadRow = {
  id: number;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  fromAddr: string;
  fromName: string | null;
  subject: string | null;
  snippet: string | null;
  isRead: boolean;
  labelIds: string[] | null;
  aiLabel:
    | "important"
    | "later"
    | "newsletter"
    | "marketing"
    | "transactional"
    | "notification"
    | null;
};

type TaskRow = {
  id: number;
  title: string;
  dueAt: number | null;
  priority: "urgent" | "high" | "medium" | "low";
};

function getSenderLabel(row: LatestThreadRow) {
  return row.fromName?.trim() || row.fromAddr;
}

function isAllCapsWord(value: string) {
  return /^[A-Z0-9&.\-_ ]+$/.test(value) && /[A-Z]/.test(value);
}

function isLikelyPersonName(name: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return false;
  if (isAllCapsWord(trimmed)) return false;

  const normalized = trimmed
    .replace(/[<>"']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (normalized.length < 2 || normalized.length > 4) {
    return false;
  }

  const disallowed = [
    "team",
    "support",
    "billing",
    "sales",
    "marketing",
    "newsletter",
    "notifications",
    "alerts",
    "report",
    "reports",
    "customer",
    "service",
    "welcome",
    "recommended",
    "recomendados",
  ];

  return normalized.every((part) => {
    const lower = part.toLowerCase();
    return /^[a-z][a-z'-]+$/i.test(part) && !disallowed.includes(lower);
  });
}

function isLikelyBulkMessage(row: LatestThreadRow) {
  const content = [
    row.fromName ?? "",
    row.fromAddr,
    row.subject ?? "",
    row.snippet ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const bulkTerms = [
    "unsubscribe",
    "newsletter",
    "digest",
    "sale",
    "discount",
    "offer",
    "promotion",
    "promo",
    "marketing",
    "campaign",
    "webinar",
    "event",
    "press release",
    "shop",
    "store",
    "sponsored",
    "deal",
    "deals",
    "book now",
    "limited time",
    "flight",
    "flights",
    "travel",
    "trip",
    "destination",
    "destinations",
    "hotel",
    "booking",
    "reservation",
    "miles",
    "rewards",
    "reward",
    "points",
    "loyalty",
  ];

  return bulkTerms.some((term) => content.includes(term)) || content.includes("#");
}

function hasMailboxLabel(row: LatestThreadRow, label: string) {
  return row.labelIds?.includes(label) ?? false;
}

function isNonActionableBriefingLabel(
  label: LatestThreadRow["aiLabel"],
) {
  return (
    label === "newsletter" ||
    label === "marketing" ||
    label === "notification" ||
    label === "transactional"
  );
}

function getSenderDomain(email: string) {
  const [, domain = ""] = email.toLowerCase().split("@");
  return domain;
}

function getImportanceTerms() {
  return [
    "proposal",
    "quote",
    "invoice",
    "contract",
    "follow up",
    "follow-up",
    "review",
    "deadline",
    "eta",
    "payment",
    "meeting",
    "call",
    "budget",
    "approval",
    "project",
    "client",
    "scope",
    "estimate",
    "feedback",
  ];
}

function getNoiseTerms() {
  return [
    "welcome",
    "bienvenido",
    "weekly report",
    "weekly summary",
    "recomendados",
    "recommended",
    "digest",
    "newsletter",
    "report",
    "summary",
    "recap",
    "alert",
    "alerts",
    "notification",
    "notifications",
    "tips",
    "ideas",
    "discover",
    "top picks",
    "most viewed",
    "más vistos",
    "resume",
    "cv",
    "job alert",
    "job posting",
    "hiring",
    "we thought you'd like",
    "selected for you",
    "for you",
    "travel",
    "flight",
    "flights",
    "miles",
    "reward",
    "rewards",
    "points",
  ];
}

function scoreImportantReply(row: LatestThreadRow, now: number) {
  let score = 0;
  const subject = row.subject?.toLowerCase() ?? "";
  const snippet = row.snippet?.toLowerCase() ?? "";
  const content = `${subject} ${snippet}`;
  const domain = getSenderDomain(row.fromAddr);
  const sender = getSenderLabel(row);
  const ageMs = now - row.date;
  const importantTerms = getImportanceTerms();
  const noiseTerms = getNoiseTerms();

  if (!row.isRead) score += 20;
  if (ageMs <= 24 * 60 * 60 * 1000) score += 10;
  if (isLikelyPersonName(row.fromName)) score += 35;
  if (!isPublicDomain(domain)) score += 10;
  if (importantTerms.some((term) => content.includes(term))) score += 30;
  if (sender.toLowerCase().includes("@")) score -= 10;
  if (isAllCapsWord(sender)) score -= 20;
  if (noiseTerms.some((term) => content.includes(term))) score -= 60;

  return score;
}

function isImportantReply(row: LatestThreadRow, now: number) {
  return scoreImportantReply(row, now) >= 35;
}

function scoreReplyRow(row: LatestThreadRow, now: number) {
  return scoreImportantReply(row, now) +
    Math.max(0, ACTIONABLE_REPLY_WINDOW_MS - (now - row.date)) /
      (24 * 60 * 60 * 1000);
}

function buildReplyReason(row: LatestThreadRow) {
  const age = formatDistanceToNowStrict(new Date(row.date), {
    addSuffix: true,
  });

  if (row.subject?.trim()) {
    return `"${row.subject.trim()}" came in ${age}.`;
  }

  return `Latest inbound message was ${age}.`;
}

function buildTaskReason(task: TaskRow, type: "overdue_task" | "due_today_task") {
  if (!task.dueAt) {
    return type === "overdue_task"
      ? "This task needs a new date."
      : "Scheduled for today.";
  }

  const age = formatDistanceToNowStrict(new Date(task.dueAt), {
    addSuffix: true,
  });

  return type === "overdue_task"
    ? `It slipped ${age}.`
    : `Due ${age}.`;
}

export async function buildBriefing(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
  includeNarrative?: boolean;
}): Promise<BriefingData> {
  const now = Date.now();
  const { day, start: dayStart, end: dayEnd } = getTodayBounds(now);

  const existing = await input.db
    .select({
      narrative: dailyBriefings.narrative,
      followUpCount: dailyBriefings.followUpCount,
      tasksDueCount: dailyBriefings.tasksDueCount,
      overdueCount: dailyBriefings.overdueCount,
      createdAt: dailyBriefings.createdAt,
    })
    .from(dailyBriefings)
    .where(and(eq(dailyBriefings.userId, input.userId), eq(dailyBriefings.date, day)))
    .limit(1);

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
        labelIds: emails.labelIds,
        aiLabel: emails.aiLabel,
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
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        priority: tasks.priority,
      })
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
      .limit(3),
    input.db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, input.userId), ne(tasks.status, "done"), lt(tasks.dueAt, now)))
      .orderBy(tasks.dueAt)
      .limit(3),
  ]);

  const latestByThread = new Map<string, LatestThreadRow>();
  for (const row of latestThreadRows) {
    const threadId = row.threadId;
    if (!threadId || latestByThread.has(threadId)) continue;
    latestByThread.set(threadId, row);
  }

  const candidateThreads = [...latestByThread.values()]
    .filter((row) => row.direction === "received")
    .filter((row) => !isNonActionableBriefingLabel(row.aiLabel))
    .filter((row) => !hasMailboxLabel(row, "CATEGORY_PROMOTIONS"))
    .filter((row) => !isAutomatedSender(row.fromAddr, row.fromName))
    .filter((row) => !isLikelyBulkMessage(row))
    .filter((row) => now - row.date <= ACTIONABLE_REPLY_WINDOW_MS)
    .sort((left, right) => scoreReplyRow(right, now) - scoreReplyRow(left, now));

  const replyNeededThreads = candidateThreads.filter((row) => isImportantReply(row, now));
  const fyiThreads = candidateThreads.filter(
    (row) => !isImportantReply(row, now) && scoreImportantReply(row, now) >= 15,
  );

  const dueTodayCount = Number(dueTodayCountRows[0]?.count ?? 0);
  const overdueCount = Number(overdueCountRows[0]?.count ?? 0);
  const needsReplyCount = replyNeededThreads.length;

  const fallbackText = buildFallbackText({
    needsReplyCount,
    dueTodayCount,
    overdueCount,
  });

  const items: BriefingItem[] = [
    ...replyNeededThreads.slice(0, 3).map((row) => ({
      id: `reply-${row.id}`,
      type: "reply" as const,
      title: getSenderLabel(row),
      reason: buildReplyReason(row),
      href: `/inbox/all?id=${row.id}`,
    })),
    ...fyiThreads.slice(0, 2).map((row) => ({
      id: `fyi-${row.id}`,
      type: "fyi" as const,
      title: getSenderLabel(row),
      reason: buildReplyReason(row),
      href: `/inbox/all?id=${row.id}`,
    })),
    ...overdueTaskRows.slice(0, 2).map((task) => ({
      id: `overdue-${task.id}`,
      type: "overdue_task" as const,
      title: task.title,
      reason: buildTaskReason(task, "overdue_task"),
      href: "/tasks",
    })),
    ...dueTodayTaskRows.slice(0, 2).map((task) => ({
      id: `today-${task.id}`,
      type: "due_today_task" as const,
      title: task.title,
      reason: buildTaskReason(task, "due_today_task"),
      href: "/tasks",
    })),
  ].slice(0, 7);

  let text = "";
  if (input.includeNarrative !== false) {
    text = fallbackText;
    try {
      if (
        existing[0]?.narrative &&
        existing[0].createdAt >= now - BRIEFING_TTL_MS &&
        Number(existing[0].followUpCount ?? 0) === needsReplyCount &&
        Number(existing[0].tasksDueCount ?? 0) === dueTodayCount &&
        Number(existing[0].overdueCount ?? 0) === overdueCount
      ) {
        text = existing[0].narrative;
      } else {
        const workersAI = createWorkersAI({ binding: input.env.AI });
        const result = await generateText({
          model: workersAI(MODEL),
          system: [
            "You are a discreet, highly competent secretary writing a daily briefing.",
            "Write one or two short sentences in plain English.",
            "Only talk about recent, actually relevant conversations that need a reply.",
            "Treat promotional mail, newsletters, notifications, receipts, travel deals, and other company-broadcast mail as irrelevant unless it is clearly part of a real human back-and-forth.",
            "Ignore stale or historical threads and never talk about unread counts.",
            "Be calm, practical, neutral, and slightly polished.",
            "Do not instruct the user, tell them what to do, or imply urgency beyond the facts.",
            "Avoid words like should, need to, please, important, urgent, and immediate attention.",
            "No markdown.",
          ].join(" "),
          prompt: [
            "Treat only the last 3 days as actionable for reply-needed threads.",
            "Exclude anything that reads like marketing, a newsletter, an alert, a receipt, a generic company update, or obvious promotional clutter even if it is recent or unread.",
            `Actionable reply-needed threads: ${needsReplyCount}`,
            `Overdue tasks: ${overdueCount}`,
            `Tasks due today: ${dueTodayCount}`,
            "Top reply-needed threads:",
            ...replyNeededThreads.slice(0, 3).map((row) => {
              const sender = getSenderLabel(row);
              const subject = row.subject?.trim() || "(no subject)";
              const age = formatDistanceToNowStrict(new Date(row.date), {
                addSuffix: true,
              });
              return `- ${sender}: ${subject}, latest inbound ${age}`;
            }),
            "Top tasks:",
            ...overdueTaskRows.map((task) => `- Overdue task: ${task.title}`),
            ...dueTodayTaskRows.map((task) => `- Due today: ${task.title}`),
          ].join("\n"),
          maxOutputTokens: 120,
        });

        const generated = (result.text ?? "").trim();
        if (generated) {
          text = generated;
        }
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
          unreadCount: null,
          followUpCount: needsReplyCount,
          tasksDueCount: dueTodayCount,
          overdueCount,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [dailyBriefings.userId, dailyBriefings.date],
          set: {
            narrative: text,
            unreadCount: null,
            followUpCount: needsReplyCount,
            tasksDueCount: dueTodayCount,
            overdueCount,
            createdAt: now,
          },
        });
    } catch {
      // FK constraint can fail if user doesn't exist yet (stale session)
    }
  }

  return {
    text,
    generatedAt: now,
    counts: {
      needsReply: needsReplyCount,
      dueToday: dueTodayCount,
      overdue: overdueCount,
    },
    items,
  };
}

export function registerGetBriefing(app: Hono<AppRouteEnv>) {
  app.get("/briefing", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const briefing = await buildBriefing({
      db,
      env: c.env,
      userId: user.id,
    });
    return c.json({ data: briefing }, 200);
  });
}

function buildStreamPrompt(items: BriefingItem[], counts: { needsReply: number; dueToday: number; overdue: number }) {
  const itemLines = items.map((item) => {
    const typeLabel =
      item.type === "reply" ? "needs reply" :
      item.type === "fyi" ? "FYI" :
      item.type === "overdue_task" ? "overdue task" :
      "due today";
    return `- ${typeLabel}: title="${item.title}", reason="${item.reason}", link=[[${item.title}|${item.href}]]`;
  });

  return [
    `Reply-needed: ${counts.needsReply}, Overdue tasks: ${counts.overdue}, Due today: ${counts.dueToday}`,
    "",
    "Keep the final paragraph compact. Group similar items together instead of repeating the same phrasing for each one.",
    "Prefer commas, semicolons, or a second sentence over repeated uses of 'and'.",
    "If several items share the same timeframe, mention that timeframe once for the group.",
    "Do not restate counts if the named items already make the point clearly.",
    "If any listed email still looks like obvious promotional or automated clutter, omit it from the prose rather than forcing it in.",
    "",
    "Relevant items to mention (use the exact [[title|href]] syntax for each item you keep):",
    ...itemLines,
  ].join("\n");
}

const STREAM_SYSTEM_PROMPT = [
  "You are a discreet, highly competent secretary writing a daily briefing as a single flowing paragraph.",
  "Weave the relevant items naturally into the text.",
  "If an item is obviously promotional, newsletter-like, automated, or non-actionable clutter, leave it out instead of mentioning it.",
  "For each item, use the EXACT link syntax [[title|href]] provided — do not change the title or href.",
  "CRITICAL: Always keep a space before and after each [[...]] link. Never let a link touch adjacent words.",
  "Write 1-2 concise sentences whenever possible.",
  "Keep it short and smooth rather than exhaustive.",
  "Group related items into a compact phrase instead of giving each one its own full clause.",
  "Avoid repetitive sentence structure and avoid back-to-back uses of 'and'.",
  "Do not instruct the user or imply urgency beyond the facts.",
  "Avoid words like should, need to, please, important, urgent, and immediate attention.",
  "No markdown, no bullet points, no headings. Just a natural paragraph with [[links]] inline.",
  "If there are no items, write a short sentence saying everything looks clear.",
].join(" ");

export function registerPostBriefingStream(app: Hono<AppRouteEnv>) {
  app.post("/briefing/stream", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;

    const briefing = await buildBriefing({ db, env, userId: user.id });

    try {
      const workersAI = createWorkersAI({ binding: env.AI });
      const result = streamText({
        model: workersAI(MODEL),
        system: STREAM_SYSTEM_PROMPT,
        prompt: buildStreamPrompt(briefing.items, briefing.counts),
        maxOutputTokens: 250,
      });

      return result.toTextStreamResponse({
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("Briefing stream failed", { userId: user.id, error });
      return new Response(briefing.text, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  });
}
