import { Output, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  type CalendarSuggestion,
  type EmailAction,
  type FilterActions,
} from "../../../db/schema";
import { truncate, withRetry } from "../../utils";

export const EMAIL_INTELLIGENCE_MODEL = "gpt-5.4-mini";
export const EMAIL_INTELLIGENCE_SCHEMA_VERSION = 1;
export const MAX_THREAD_MESSAGES = 6;
export const MAX_ACTIONS = 4;
export const INLINE_PROCESS_LIMIT = 5;
export const MAX_RETRY_ATTEMPTS = 3;
export const ELIGIBILITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const emailActionOutputSchema = z.object({
  type: z.enum(["reply", "archive", "label", "snooze"]),
  label: z.string().trim().min(1).max(120),
  payload: z.object({
    draft: z.string().trim().max(2000).nullable(),
    labelName: z.string().trim().max(120).nullable(),
    until: z.string().trim().max(100).nullable(),
  }),
  trustLevel: z.enum(["auto", "approve"]),
});

export const calendarSuggestionOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  proposedDate: z.string().trim().min(1).max(100),
  confidence: z.enum(["high", "low"]),
  sourceText: z.string().trim().min(1).max(500),
});

export const emailTriageOutputSchema = z.object({
  category: z.enum([
    "important",
    "action_needed",
    "newsletter",
    "notification",
    "transactional",
  ]),
  urgency: z.enum(["high", "medium", "low"]),
  briefingSentence: z.string().trim().max(360).nullable(),
  actions: z.array(emailActionOutputSchema).max(MAX_ACTIONS),
  calendarEvents: z.array(calendarSuggestionOutputSchema),
  matchedFilterIds: z.array(z.number().int().positive()),
});

export const emailDetailOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  actions: z.array(emailActionOutputSchema).max(MAX_ACTIONS),
  calendarEvents: z.array(calendarSuggestionOutputSchema),
});

export type EmailTriageOutput = z.infer<typeof emailTriageOutputSchema>;
export type EmailDetailOutput = z.infer<typeof emailDetailOutputSchema>;

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

export type ActiveEmailFilter = {
  id: number;
  description: string;
  actions: FilterActions;
};

export type StoredEmailTriage = {
  category: "important" | "action_needed" | "newsletter" | "notification" | "transactional";
  urgency: "high" | "medium" | "low";
  briefingSentence: string | null;
  actions: EmailAction[];
  calendarEvents: CalendarSuggestion[];
  autoExecute: string[];
  requiresApproval: string[];
};

export type EmailDetailIntelligence = {
  summary: string;
  actions: EmailAction[];
  calendarEvents: CalendarSuggestion[];
  autoExecute: string[];
  requiresApproval: string[];
};

export function buildSharedActionRules() {
  return [
    "## Action Rules",
    "- Only use action types: reply, archive, label, snooze.",
    "- Every action object must include payload with keys draft, labelName, and until. Use null for unused fields.",
    "- Do NOT suggest reply actions for automated notifications, newsletters, promos, or social network emails unless a human response is explicitly expected.",
    "- Do NOT copy URLs, tracking links, or long CTA links into reply drafts.",
    "- Keep reply drafts short and plain text.",
    "- For reply actions, include payload.draft with the full reply body text.",
    "- For snooze actions, include payload.until as an ISO date or datetime.",
    "- For label actions, include payload.labelName.",
    "",
    "## Trust Levels",
    "- Use trustLevel=approve for replies and any external commitment.",
    "- Use trustLevel=auto only for clearly safe local actions like archive or snooze.",
  ].join("\n");
}

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

function normalizeBriefingSentence(value: string | null) {
  if (!value) return null;
  const normalized = truncate(value.replace(/\s+/g, " ").trim(), 360);
  return normalized.length > 0 ? normalized : null;
}

function normalizeSummary(value: string) {
  return truncate(value.replace(/\s+/g, " ").trim(), 500);
}

function normalizeReplyDraft(payload: Record<string, unknown>) {
  const draft = typeof payload.draft === "string" ? payload.draft.trim() : "";
  return draft.length > 0 ? truncate(draft, 2000) : null;
}

function normalizeSnoozeUntil(payload: Record<string, unknown>) {
  const until = typeof payload.until === "string" ? payload.until.trim() : "";
  if (!until) return null;
  const parsed = new Date(until).getTime();
  return Number.isFinite(parsed) ? parsed : null;
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

  if (action.type === "snooze") {
    const until = normalizeSnoozeUntil(payload);
    if (!until) return null;
    payload.until = until;
  }

  if (action.type === "label") {
    const labelName =
      typeof payload.labelName === "string" ? payload.labelName.trim() : "";
    if (!labelName) return null;
    payload.labelName = truncate(labelName, 120);
  }

  return {
    id: stableActionId(emailId, { type: action.type, label, payload }),
    type: action.type,
    label,
    payload,
    trustLevel: action.trustLevel,
    status: "pending",
    error: null,
    executedAt: null,
    updatedAt: now,
  };
}

function normalizeCalendarSuggestion(
  emailId: number,
  suggestion: { title: string; proposedDate: string; confidence: CalendarSuggestion["confidence"]; sourceText: string },
  now: number,
): CalendarSuggestion | null {
  const proposedDate = suggestion.proposedDate.trim();
  const title = truncate(suggestion.title.replace(/\s+/g, " ").trim(), 200);
  const sourceText = truncate(
    suggestion.sourceText.replace(/\s+/g, " ").trim(),
    500,
  );

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
    id: stableCalendarSuggestionId(emailId, {
      title,
      proposedDate,
      sourceText,
    }),
    title,
    proposedDate,
    startAt,
    endAt,
    isAllDay: allDay,
    confidence: suggestion.confidence,
    sourceText,
    status: "pending",
    location: null,
    attendees: null,
    googleEventId: null,
    updatedAt: now,
  };
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

export function deriveActionBuckets(actions: EmailAction[]) {
  const autoExecute: string[] = [];
  const requiresApproval: string[] = [];

  for (const action of actions) {
    if (action.status !== "pending") continue;
    if (action.trustLevel === "auto") autoExecute.push(action.id);
    else requiresApproval.push(action.id);
  }

  return { autoExecute, requiresApproval };
}

function normalizeIntelligenceActions(
  emailId: number,
  actions: EmailTriageOutput["actions"],
  calendarEventsRaw: EmailTriageOutput["calendarEvents"],
  now: number,
) {
  const normalizedActions = actions
    .slice(0, MAX_ACTIONS)
    .map((action) => normalizeAction(emailId, action, now))
    .filter((action): action is EmailAction => action !== null);
  const calendarEvents = calendarEventsRaw
    .map((event) => normalizeCalendarSuggestion(emailId, event, now))
    .filter((event): event is CalendarSuggestion => event !== null);

  return { actions: normalizedActions, calendarEvents, ...deriveActionBuckets(normalizedActions) };
}

export function normalizeEmailTriageOutput(
  emailId: number,
  output: EmailTriageOutput,
  now = Date.now(),
): StoredEmailTriage {
  return {
    category: output.category,
    urgency: output.urgency,
    briefingSentence: normalizeBriefingSentence(output.briefingSentence),
    ...normalizeIntelligenceActions(emailId, output.actions, output.calendarEvents, now),
  };
}

export function normalizeEmailDetailOutput(
  emailId: number,
  output: EmailDetailOutput,
  now = Date.now(),
): EmailDetailIntelligence {
  return {
    summary: normalizeSummary(output.summary),
    ...normalizeIntelligenceActions(emailId, output.actions, output.calendarEvents, now),
  };
}

export function getStoredReplyDraft(
  intelligence:
    | Pick<StoredEmailTriage, "actions">
    | Pick<EmailDetailIntelligence, "actions">
    | null
    | undefined,
) {
  const replyAction = intelligence?.actions.find(
    (action) =>
      action.status === "pending" &&
      action.type === "reply" &&
      typeof action.payload.draft === "string",
  );

  return typeof replyAction?.payload.draft === "string"
    ? replyAction.payload.draft
    : null;
}

export async function generateStructuredEmailObject<T extends z.ZodTypeAny>(input: {
  env: Env;
  prompt: string;
  system: string;
  schema: T;
}) {
  if (!input.env.OPENAI_API_KEY) {
    throw new Error("No email intelligence model succeeded");
  }

  const openai = createOpenAI({ apiKey: input.env.OPENAI_API_KEY });

  try {
    const result = await withRetry(
      () =>
        generateText({
          model: openai.responses(EMAIL_INTELLIGENCE_MODEL),
          prompt: input.prompt,
          system: input.system,
          maxOutputTokens: 1200,
          output: Output.object({ schema: input.schema }),
        }),
      {
        maxRetries: 2,
        baseDelayMs: 1000,
        label: `email-intelligence:${EMAIL_INTELLIGENCE_MODEL}`,
      },
    );

    return {
      object: result.output as z.infer<T>,
      model: EMAIL_INTELLIGENCE_MODEL,
    };
  } catch (error) {
    console.error("Email intelligence failed", {
      model: EMAIL_INTELLIGENCE_MODEL,
      error,
    });
    throw error;
  }
}
