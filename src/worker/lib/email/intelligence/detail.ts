import { eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import type {
  CalendarSuggestion,
  EmailAction,
  EmailSuspiciousFlag,
} from "../../../db/schema";
import { emailIntelligence } from "../../../db/schema";
import { buildSessionAffinityKey } from "../../ai/session-affinity";
import {
  buildSourceHash,
  buildThreadPrompt,
  emailOnDemandOutputSchema,
  generateStructuredEmailObject,
  normalizeEmailOnDemandOutput,
} from "./common";
import { loadEmailContext } from "./store";

const ON_DEMAND_SYSTEM = [
  "You are an email assistant. Analyze the email and its thread.",
  "Return a JSON object with:",
  "- summary: 1-2 sentences describing what the sender wants and what is at stake. Be specific — include names, amounts, and deadlines.",
  "- replyDraft: a short plain-text reply body if a human personal response is clearly expected. null for newsletters, automated notifications, receipts, or any email not requiring a personal reply.",
  "- taskSuggestion: { title (clear actionable imperative, e.g. 'Pay Aquaservice invoice €34.58', 'Sign DocuSign document'), dueAt (ISO date if a deadline exists, else null), priority (urgent/high/medium/low) } if a payment, deadline, signature, verification, or commitment is present. null otherwise.",
  "- calendarSuggestion: { title, proposedDate (ISO date or datetime), sourceText (the exact text mentioning the event) } if a meeting or event with enough detail is mentioned. null otherwise.",
].join(" ");

export type EmailOnDemandResult = {
  summary: string | null;
  suspicious: EmailSuspiciousFlag;
  replyDraft: string | null;
  taskSuggestion: {
    title: string;
    dueAt: number | null;
    priority: "urgent" | "high" | "medium" | "low" | null;
  } | null;
  calendarSuggestion: CalendarSuggestion | null;
};

function extractOnDemandResult(row: {
  summary: string | null;
  suspiciousJson: EmailSuspiciousFlag | null;
  actionsJson: EmailAction[] | null;
  calendarEventsJson: CalendarSuggestion[] | null;
}): EmailOnDemandResult {
  const actions = row.actionsJson ?? [];
  const replyAction = actions.find(
    (a) => a.type === "reply" && a.status === "pending",
  );
  const taskAction = actions.find(
    (a) => a.type === "create_task" && a.status === "pending",
  );
  const calendarSuggestion =
    (row.calendarEventsJson ?? []).find((e) => e.status === "pending") ?? null;

  const replyDraft =
    typeof replyAction?.payload.draft === "string"
      ? replyAction.payload.draft
      : null;

  const taskSuggestion = taskAction
    ? {
        title:
          typeof taskAction.payload.taskTitle === "string"
            ? taskAction.payload.taskTitle
            : "",
        dueAt:
          typeof taskAction.payload.taskDueAt === "number"
            ? taskAction.payload.taskDueAt
            : null,
        priority: ["urgent", "high", "medium", "low"].includes(
          String(taskAction.payload.taskPriority),
        )
          ? (taskAction.payload.taskPriority as
              | "urgent"
              | "high"
              | "medium"
              | "low")
          : null,
      }
    : null;

  return {
    summary: row.summary,
    suspicious: row.suspiciousJson ?? {
      isSuspicious: false,
      kind: null,
      reason: null,
      confidence: null,
    },
    replyDraft,
    taskSuggestion: taskSuggestion?.title ? taskSuggestion : null,
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

export async function getStoredEmailOnDemand(
  db: Database,
  emailId: number,
): Promise<EmailOnDemandResult | null> {
  const rows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const result = extractOnDemandResult(row);
  return hasOnDemandContent(result) ? result : null;
}

export async function generateEmailOnDemand(
  db: Database,
  env: Env,
  emailId: number,
): Promise<EmailOnDemandResult | null> {
  const context = await loadEmailContext(db, emailId);
  if (!context) return null;

  const { email, threadMessages } = context;
  const now = Date.now();
  const currentHash = await buildSourceHash(email, threadMessages);

  const rows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const existing = rows[0] ?? null;

  if (existing?.summary && existing.sourceHash === currentHash) {
    return extractOnDemandResult(existing);
  }

  const prompt = buildThreadPrompt(email, threadMessages);
  const { object } = await generateStructuredEmailObject({
    env,
    prompt,
    system: ON_DEMAND_SYSTEM,
    schema: emailOnDemandOutputSchema,
    sessionAffinityKey: buildSessionAffinityKey(
      "email-intelligence-ondemand",
      email.userId,
      emailId,
    ),
  });

  const normalized = normalizeEmailOnDemandOutput(emailId, object, now);

  if (existing) {
    await db
      .update(emailIntelligence)
      .set({
        summary: normalized.summary,
        actionsJson: normalized.actions,
        calendarEventsJson: normalized.calendarEvents,
        updatedAt: now,
      })
      .where(eq(emailIntelligence.emailId, emailId));
  } else {
    // Background triage hasn't run yet — insert a placeholder row
    await db
      .insert(emailIntelligence)
      .values({
        emailId,
        userId: email.userId,
        mailboxId: email.mailboxId,
        status: "pending",
        summary: normalized.summary,
        actionsJson: normalized.actions,
        calendarEventsJson: normalized.calendarEvents,
        sourceHash: currentHash,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [emailIntelligence.emailId],
        set: {
          summary: normalized.summary,
          actionsJson: normalized.actions,
          calendarEventsJson: normalized.calendarEvents,
          updatedAt: now,
        },
      });
  }

  const replyAction = normalized.actions.find((a) => a.type === "reply");
  const taskAction = normalized.actions.find((a) => a.type === "create_task");

  return {
    summary: normalized.summary,
    suspicious: existing?.suspiciousJson ?? {
      isSuspicious: false,
      kind: null,
      reason: null,
      confidence: null,
    },
    replyDraft:
      typeof replyAction?.payload.draft === "string"
        ? replyAction.payload.draft
        : null,
    taskSuggestion: taskAction
      ? {
          title:
            typeof taskAction.payload.taskTitle === "string"
              ? taskAction.payload.taskTitle
              : "",
          dueAt:
            typeof taskAction.payload.taskDueAt === "number"
              ? taskAction.payload.taskDueAt
              : null,
          priority: ["urgent", "high", "medium", "low"].includes(
            String(taskAction.payload.taskPriority),
          )
            ? (taskAction.payload.taskPriority as
                | "urgent"
                | "high"
                | "medium"
                | "low")
            : null,
        }
      : null,
    calendarSuggestion: normalized.calendarEvents[0] ?? null,
  };
}

export async function updateCalendarSuggestionStatus(
  db: Database,
  emailId: number,
  suggestionId: number,
  status: "approved" | "dismissed",
) {
  const rows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  const calendarEvents = (row.calendarEventsJson ?? []).map((entry) =>
    entry.id === suggestionId
      ? { ...entry, status, updatedAt: Date.now() }
      : entry,
  );

  await db
    .update(emailIntelligence)
    .set({ calendarEventsJson: calendarEvents, updatedAt: Date.now() })
    .where(eq(emailIntelligence.emailId, emailId));
}
