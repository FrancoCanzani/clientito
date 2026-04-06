import { Output, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  type CalendarSuggestion,
  type EmailAction,
  type EmailSuspiciousFlag,
  type FilterActions,
} from "../../../db/schema";
import { AI_MODELS } from "../../constants";
import { truncate, withRetry } from "../../utils";

export const EMAIL_INTELLIGENCE_MODELS = AI_MODELS;
export const EMAIL_INTELLIGENCE_SCHEMA_VERSION = 1;
export const MAX_THREAD_MESSAGES = 6;
export const INLINE_PROCESS_LIMIT = 5;
export const MAX_RETRY_ATTEMPTS = 3;
export const ELIGIBILITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const suspiciousFlagOutputSchema = z.object({
  isSuspicious: z.boolean(),
  kind: z.enum([
    "phishing",
    "impersonation",
    "credential_harvest",
    "payment_fraud",
  ]).nullable(),
  reason: z.string().trim().max(280).nullable(),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
});

/** Background triage: classification only */
export const emailTriageOutputSchema = z.object({
  category: z.enum([
    "important",
    "action_needed",
    "newsletter",
    "notification",
    "transactional",
  ]),
  urgency: z.enum(["high", "medium", "low"]),
  suspicious: suspiciousFlagOutputSchema,
  matchedFilterIds: z.array(z.number().int().positive()),
});

/** On-demand analysis: triggered when user opens an email */
export const emailOnDemandOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  replyDraft: z.string().trim().max(2000).nullable(),
  taskSuggestion: z.object({
    title: z.string().trim().min(1).max(200),
    dueAt: z.string().trim().max(100).nullable(),
    priority: z.enum(["urgent", "high", "medium", "low"]).nullable(),
  }).nullable(),
  calendarSuggestion: z.object({
    title: z.string().trim().min(1).max(200),
    proposedDate: z.string().trim().min(1).max(100),
    sourceText: z.string().trim().min(1).max(500),
  }).nullable(),
});

export type EmailTriageOutput = z.infer<typeof emailTriageOutputSchema>;
export type EmailOnDemandOutput = z.infer<typeof emailOnDemandOutputSchema>;

export type ActiveEmailFilter = {
  id: number;
  description: string;
  actions: FilterActions;
};

export type StoredEmailTriage = {
  category: "important" | "action_needed" | "newsletter" | "notification" | "transactional";
  urgency: "high" | "medium" | "low";
  suspicious: EmailSuspiciousFlag;
};

export type EmailContextRow = {
  id: number;
  userId: string;
  mailboxId: number | null;
  providerMessageId: string;
  threadId: string | null;
  messageId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
  labelIds: string[] | null;
  snoozedUntil: number | null;
};

export function compactText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function stableNumber(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) || 1;
}

function stableActionId(
  emailId: number,
  action: { type: string; label: string; payload: Record<string, unknown> },
) {
  return `${action.type}-${stableNumber(`${emailId}:${action.label}:${JSON.stringify(action.payload)}`).toString(36)}`;
}

function stableCalendarSuggestionId(
  emailId: number,
  suggestion: { title: string; proposedDate: string; sourceText: string },
) {
  return stableNumber(
    `${emailId}:${suggestion.title}:${suggestion.proposedDate}:${suggestion.sourceText}`,
  );
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeSummary(value: string) {
  return truncate(value.replace(/\s+/g, " ").trim(), 500);
}

function normalizeSuspiciousFlag(
  suspicious: EmailTriageOutput["suspicious"],
): EmailSuspiciousFlag {
  if (!suspicious?.isSuspicious) {
    return { isSuspicious: false, kind: null, reason: null, confidence: null };
  }

  const reason = typeof suspicious.reason === "string"
    ? truncate(suspicious.reason.replace(/\s+/g, " ").trim(), 280)
    : "";

  return {
    isSuspicious: true,
    kind: suspicious.kind ?? null,
    reason: reason || null,
    confidence: suspicious.confidence ?? null,
  };
}

function normalizeReplyDraft(payload: Record<string, unknown>) {
  const draft = typeof payload.draft === "string" ? payload.draft.trim() : "";
  return draft.length > 0 ? truncate(draft, 2000) : null;
}

function normalizeAction(
  emailId: number,
  action: { type: EmailAction["type"]; label: string; payload: Record<string, unknown>; trustLevel: EmailAction["trustLevel"] },
  now: number,
): EmailAction | null {
  const label = truncate(action.label.replace(/\s+/g, " ").trim(), 120);
  if (!label) return null;

  const payload = { ...action.payload };

  if (action.type === "reply") {
    const draft = normalizeReplyDraft(payload);
    if (!draft) return null;
    payload.draft = draft;
  }

  if (action.type === "create_task") {
    const taskTitle =
      typeof payload.taskTitle === "string" ? payload.taskTitle.trim() : "";
    if (!taskTitle) return null;
    payload.taskTitle = truncate(taskTitle, 200);

    const taskDueAt =
      typeof payload.taskDueAt === "string" ? payload.taskDueAt.trim() : "";
    if (taskDueAt) {
      const parsed = new Date(taskDueAt).getTime();
      payload.taskDueAt = Number.isFinite(parsed) ? parsed : null;
    } else {
      payload.taskDueAt = null;
    }

    const validPriorities = ["urgent", "high", "medium", "low"];
    payload.taskPriority = validPriorities.includes(String(payload.taskPriority))
      ? payload.taskPriority
      : null;

    payload.taskStatus = "todo";
  }

  return {
    id: stableActionId(emailId, { type: action.type, label, payload }),
    type: action.type,
    label,
    payload,
    trustLevel: "approve",
    status: "pending",
    error: null,
    executedAt: null,
    updatedAt: now,
  };
}

function normalizeCalendarSuggestion(
  emailId: number,
  suggestion: { title: string; proposedDate: string; sourceText: string },
  now: number,
): CalendarSuggestion | null {
  const proposedDate = suggestion.proposedDate.trim();
  const title = truncate(suggestion.title.replace(/\s+/g, " ").trim(), 200);
  const sourceText = truncate(suggestion.sourceText.replace(/\s+/g, " ").trim(), 500);

  if (!title || !sourceText) return null;

  let startAt = 0;
  let endAt = 0;
  let allDay = false;

  if (isDateOnly(proposedDate)) {
    startAt = new Date(`${proposedDate}T00:00:00.000Z`).getTime();
    endAt = startAt + 24 * 60 * 60 * 1000;
    allDay = true;
  } else {
    startAt = new Date(proposedDate).getTime();
    endAt = startAt + 60 * 60 * 1000;
  }

  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt <= 0) {
    return null;
  }

  return {
    id: stableCalendarSuggestionId(emailId, { title, proposedDate, sourceText }),
    title,
    proposedDate,
    startAt,
    endAt,
    isAllDay: allDay,
    confidence: "high",
    sourceText,
    status: "pending",
    location: null,
    attendees: null,
    googleEventId: null,
    updatedAt: now,
  };
}

export function normalizeEmailTriageOutput(
  output: EmailTriageOutput,
): StoredEmailTriage {
  return {
    category: output.category,
    urgency: output.urgency,
    suspicious: normalizeSuspiciousFlag(output.suspicious),
  };
}

export function normalizeEmailOnDemandOutput(
  emailId: number,
  output: EmailOnDemandOutput,
  now: number,
): { summary: string; actions: EmailAction[]; calendarEvents: CalendarSuggestion[] } {
  const actions: EmailAction[] = [];

  if (output.replyDraft) {
    const action = normalizeAction(
      emailId,
      {
        type: "reply",
        label: "Reply",
        payload: { draft: output.replyDraft },
        trustLevel: "approve",
      },
      now,
    );
    if (action) actions.push(action);
  }

  if (output.taskSuggestion) {
    const action = normalizeAction(
      emailId,
      {
        type: "create_task",
        label: output.taskSuggestion.title,
        payload: {
          taskTitle: output.taskSuggestion.title,
          taskDueAt: output.taskSuggestion.dueAt,
          taskPriority: output.taskSuggestion.priority,
        },
        trustLevel: "approve",
      },
      now,
    );
    if (action) actions.push(action);
  }

  const calendarEvents: CalendarSuggestion[] = [];
  if (output.calendarSuggestion) {
    const event = normalizeCalendarSuggestion(emailId, output.calendarSuggestion, now);
    if (event) calendarEvents.push(event);
  }

  return { summary: normalizeSummary(output.summary), actions, calendarEvents };
}

export function normalizeMatchedFilterIds(
  matchedFilterIds: number[],
  filters: ActiveEmailFilter[],
) {
  if (filters.length === 0 || matchedFilterIds.length === 0) return [];
  const filterIds = new Set(filters.map((filter) => filter.id));
  return [...new Set(matchedFilterIds)].filter((id) => filterIds.has(id));
}

export async function buildSourceHash(email: EmailContextRow, threadMessages: EmailContextRow[]) {
  const input = JSON.stringify({
    emailId: email.id,
    threadId: email.threadId,
    subject: email.subject ?? null,
    snippet: email.snippet ?? null,
    fromAddr: email.fromAddr,
    fromName: email.fromName ?? null,
    toAddr: email.toAddr ?? null,
    ccAddr: email.ccAddr ?? null,
    messageId: email.messageId ?? null,
    date: email.date,
    thread: threadMessages.map((message) => ({
      id: message.id,
      fromAddr: message.fromAddr,
      fromName: message.fromName ?? null,
      subject: message.subject ?? null,
      bodyText: compactText(message.bodyText, 1200),
      date: message.date,
    })),
  });

  return sha256(input);
}

export function buildThreadPrompt(email: EmailContextRow, threadMessages: EmailContextRow[]) {
  const threadBlock = threadMessages
    .map((message, index) => {
      const sender = message.fromName?.trim() || message.fromAddr;
      const body = compactText(message.bodyText, 1800) || "(empty)";
      return [
        `Message ${index + 1}`,
        `From: ${sender} <${message.fromAddr}>`,
        `Date: ${new Date(message.date).toISOString()}`,
        `Subject: ${message.subject ?? "(no subject)"}`,
        `Body: ${body}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Email ID: ${email.id}`,
    `Current message date: ${new Date(email.date).toISOString()}`,
    `From: ${email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr}`,
    `To: ${email.toAddr ?? "(unknown)"}`,
    `Cc: ${email.ccAddr ?? "(none)"}`,
    `Subject: ${email.subject ?? "(no subject)"}`,
    `Snippet: ${compactText(email.snippet, 240) || "(empty)"}`,
    "",
    "Thread:",
    threadBlock,
  ].join("\n");
}

export function buildFilterPrompt(filters: ActiveEmailFilter[]) {
  if (filters.length === 0) return null;

  return [
    "",
    "Active filters:",
    ...filters.map((filter) => `Filter ${filter.id}: ${filter.description}`),
  ].join("\n");
}

export async function generateStructuredEmailObject<T extends z.ZodTypeAny>(input: {
  env: Env;
  prompt: string;
  system: string;
  schema: T;
  sessionAffinityKey: string;
}) {
  const openai = createOpenAI({
    apiKey: input.env.OPENAI_API_KEY,
    headers: {
      "x-session-affinity": input.sessionAffinityKey,
    },
  });
  let lastError: unknown = null;

  for (const modelName of EMAIL_INTELLIGENCE_MODELS) {
    try {
      const result = await withRetry(
        () =>
          generateText({
            model: openai.responses(modelName),
            prompt: input.prompt,
            system: input.system,
            maxOutputTokens: 1200,
            output: Output.object({ schema: input.schema }),
          }),
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          label: `email-intelligence:${modelName}`,
        },
      );

      return {
        object: result.output as z.infer<T>,
        model: modelName,
      };
    } catch (error) {
      lastError = error;
      console.error("Email intelligence failed", {
        model: modelName,
        error,
      });
    }
  }

  throw lastError ?? new Error("No email intelligence model succeeded");
}
