import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../db/client";
import type {
  CalendarSuggestion,
  EmailAction,
  EmailSuspiciousFlag,
} from "../../../db/schema";
import { emailIntelligence } from "../../../db/schema";
import { truncate } from "../../utils";
import {
  DEFAULT_SUSPICIOUS_FLAG,
  EMAIL_INTELLIGENCE_SCHEMA_VERSION,
  buildSourceHash,
  buildThreadPrompt,
  generateStructuredEmailObject,
} from "./common";
import { loadEmailContext } from "./store";

const ON_DEMAND_SYSTEM = [
  "You are an email assistant. Analyze the email and its thread.",
  "Return a JSON object with:",
  "- summary: 1-2 sentences describing what the sender wants and what is at stake. Be specific — include names, amounts, and deadlines.",
  "- replyDraft: a short plain-text reply body if a human personal response is clearly expected. null for newsletters, automated notifications, receipts, or any email not requiring a personal reply.",
  "- taskSuggestion: { title (clear actionable imperative, e.g. 'Pay Aquaservice invoice EUR34.58', 'Sign DocuSign document'), dueAt (ISO date if a deadline exists, else null), priority (urgent/high/medium/low) } if a payment, deadline, signature, verification, or commitment is present. null otherwise.",
  "- calendarSuggestion: { title, proposedDate (ISO date or datetime), sourceText (the exact text mentioning the event) } if a meeting or event with enough detail is mentioned. null otherwise.",
].join(" ");

const emailOnDemandOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  replyDraft: z.string().trim().max(2000).nullable(),
  taskSuggestion: z
    .object({
      title: z.string().trim().min(1).max(200),
      dueAt: z.string().trim().max(100).nullable(),
      priority: z.enum(["urgent", "high", "medium", "low"]).nullable(),
    })
    .nullable(),
  calendarSuggestion: z
    .object({
      title: z.string().trim().min(1).max(200),
      proposedDate: z.string().trim().min(1).max(100),
      sourceText: z.string().trim().min(1).max(500),
    })
    .nullable(),
});

type EmailOnDemandOutput = z.infer<typeof emailOnDemandOutputSchema>;

type TaskSuggestion = {
  title: string;
  dueAt: number | null;
  priority: "urgent" | "high" | "medium" | "low" | null;
};

export type EmailOnDemandResult = {
  summary: string | null;
  suspicious: EmailSuspiciousFlag;
  replyDraft: string | null;
  taskSuggestion: TaskSuggestion | null;
  calendarSuggestion: CalendarSuggestion | null;
};

function whereByEmailId(emailId: number, userId?: string) {
  return userId
    ? and(
        eq(emailIntelligence.userId, userId),
        eq(emailIntelligence.emailId, emailId),
      )
    : eq(emailIntelligence.emailId, emailId);
}

function toApiResult(row: {
  summary: string | null;
  suspiciousJson: EmailSuspiciousFlag | null;
  actionsJson: EmailAction[] | null;
  calendarEventsJson: CalendarSuggestion[] | null;
}): EmailOnDemandResult {
  const actions = row.actionsJson ?? [];

  const replyAction = actions.find(
    (action) => action.type === "reply" && action.status === "pending",
  );
  const taskAction = actions.find(
    (action) => action.type === "create_task" && action.status === "pending",
  );

  const replyDraft =
    typeof replyAction?.payload.draft === "string"
      ? replyAction.payload.draft
      : null;

  let taskSuggestion: TaskSuggestion | null = null;
  if (taskAction) {
    const title =
      typeof taskAction.payload.taskTitle === "string"
        ? taskAction.payload.taskTitle.trim()
        : "";

    if (title) {
      taskSuggestion = {
        title,
        dueAt:
          typeof taskAction.payload.taskDueAt === "number"
            ? taskAction.payload.taskDueAt
            : null,
        priority: ["urgent", "high", "medium", "low"].includes(
          String(taskAction.payload.taskPriority),
        )
          ? (taskAction.payload.taskPriority as TaskSuggestion["priority"])
          : null,
      };
    }
  }

  const calendarSuggestion =
    (row.calendarEventsJson ?? []).find((event) => event.status === "pending") ??
    null;

  return {
    summary: row.summary,
    suspicious: row.suspiciousJson ?? DEFAULT_SUSPICIOUS_FLAG,
    replyDraft,
    taskSuggestion,
    calendarSuggestion,
  };
}

function hasOnDemandContent(result: EmailOnDemandResult): boolean {
  return Boolean(
    result.summary ||
      result.replyDraft ||
      result.taskSuggestion ||
      result.calendarSuggestion ||
      result.suspicious.isSuspicious,
  );
}

function normalizeOnDemandOutput(
  emailId: number,
  output: EmailOnDemandOutput,
  now: number,
): {
  summary: string;
  actions: EmailAction[];
  calendarEvents: CalendarSuggestion[];
  replyDraft: string | null;
  taskSuggestion: TaskSuggestion | null;
  calendarSuggestion: CalendarSuggestion | null;
} {
  const summary = truncate(output.summary.replace(/\s+/g, " ").trim(), 500);

  const replyDraft = output.replyDraft?.trim()
    ? truncate(output.replyDraft.trim(), 2000)
    : null;

  let taskSuggestion: TaskSuggestion | null = null;
  if (output.taskSuggestion) {
    const title = truncate(
      output.taskSuggestion.title.replace(/\s+/g, " ").trim(),
      200,
    );

    if (title) {
      const dueAtValue = output.taskSuggestion.dueAt?.trim() ?? "";
      const dueAtParsed = dueAtValue ? new Date(dueAtValue).getTime() : NaN;

      taskSuggestion = {
        title,
        dueAt:
          Number.isFinite(dueAtParsed) && dueAtParsed > 0 ? dueAtParsed : null,
        priority: output.taskSuggestion.priority ?? null,
      };
    }
  }

  const actions: EmailAction[] = [];

  if (replyDraft) {
    actions.push({
      id: `reply-${emailId}`,
      type: "reply",
      label: "Reply",
      payload: { draft: replyDraft },
      trustLevel: "approve",
      status: "pending",
      error: null,
      executedAt: null,
      updatedAt: now,
    });
  }

  if (taskSuggestion) {
    actions.push({
      id: `task-${emailId}`,
      type: "create_task",
      label: taskSuggestion.title,
      payload: {
        taskTitle: taskSuggestion.title,
        taskDueAt: taskSuggestion.dueAt,
        taskPriority: taskSuggestion.priority,
        taskStatus: "todo",
      },
      trustLevel: "approve",
      status: "pending",
      error: null,
      executedAt: null,
      updatedAt: now,
    });
  }

  let calendarSuggestion: CalendarSuggestion | null = null;
  if (output.calendarSuggestion) {
    const title = truncate(
      output.calendarSuggestion.title.replace(/\s+/g, " ").trim(),
      200,
    );
    const sourceText = truncate(
      output.calendarSuggestion.sourceText.replace(/\s+/g, " ").trim(),
      500,
    );
    const proposedDate = output.calendarSuggestion.proposedDate.trim();

    if (title && sourceText && proposedDate) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(proposedDate);
      const startAt = isDateOnly
        ? new Date(`${proposedDate}T00:00:00.000Z`).getTime()
        : new Date(proposedDate).getTime();
      const endAt = isDateOnly
        ? startAt + 24 * 60 * 60 * 1000
        : startAt + 60 * 60 * 1000;

      if (Number.isFinite(startAt) && Number.isFinite(endAt) && startAt > 0) {
        calendarSuggestion = {
          id: emailId,
          title,
          proposedDate,
          sourceText,
          startAt,
          endAt,
          isAllDay: isDateOnly,
          confidence: "high",
          status: "pending",
          location: null,
          attendees: null,
          googleEventId: null,
          updatedAt: now,
        };
      }
    }
  }

  return {
    summary,
    actions,
    calendarEvents: calendarSuggestion ? [calendarSuggestion] : [],
    replyDraft,
    taskSuggestion,
    calendarSuggestion,
  };
}

export async function getStoredEmailOnDemand(
  db: Database,
  emailId: number,
  userId?: string,
): Promise<EmailOnDemandResult | null> {
  const rows = await db
    .select()
    .from(emailIntelligence)
    .where(whereByEmailId(emailId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const result = toApiResult(row);
  return hasOnDemandContent(result) ? result : null;
}

export async function generateEmailOnDemand(
  db: Database,
  env: Env,
  emailId: number,
  userId?: string,
): Promise<EmailOnDemandResult | null> {
  const context = await loadEmailContext(db, emailId, userId);
  if (!context) return null;

  const { email, threadMessages } = context;
  const now = Date.now();
  const sourceHash = await buildSourceHash(email, threadMessages);

  const existingRows = await db
    .select()
    .from(emailIntelligence)
    .where(whereByEmailId(emailId, userId))
    .limit(1);

  const existing = existingRows[0] ?? null;

  if (existing?.sourceHash === sourceHash) {
    const cached = toApiResult(existing);
    if (hasOnDemandContent(cached)) return cached;
  }

  const prompt = buildThreadPrompt(email, threadMessages);
  const { object, model } = await generateStructuredEmailObject({
    env,
    prompt,
    system: ON_DEMAND_SYSTEM,
    schema: emailOnDemandOutputSchema,
  });

  const normalized = normalizeOnDemandOutput(emailId, object, now);
  const suspicious = existing?.suspiciousJson ?? DEFAULT_SUSPICIOUS_FLAG;

  await db
    .insert(emailIntelligence)
    .values({
      emailId,
      userId: email.userId,
      mailboxId: email.mailboxId,
      status: existing?.status ?? "pending",
      summary: normalized.summary,
      suspiciousJson: suspicious,
      actionsJson: normalized.actions,
      calendarEventsJson: normalized.calendarEvents,
      sourceHash,
      model,
      schemaVersion: EMAIL_INTELLIGENCE_SCHEMA_VERSION,
      attemptCount: existing?.attemptCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailIntelligence.emailId],
      set: {
        mailboxId: email.mailboxId,
        summary: normalized.summary,
        actionsJson: normalized.actions,
        calendarEventsJson: normalized.calendarEvents,
        sourceHash,
        model,
        schemaVersion: EMAIL_INTELLIGENCE_SCHEMA_VERSION,
        updatedAt: now,
      },
    });

  return {
    summary: normalized.summary,
    suspicious,
    replyDraft: normalized.replyDraft,
    taskSuggestion: normalized.taskSuggestion,
    calendarSuggestion: normalized.calendarSuggestion,
  };
}
