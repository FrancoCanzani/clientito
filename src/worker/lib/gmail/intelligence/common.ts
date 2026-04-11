import { Output, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  type EmailSuspiciousFlag,
  type FilterActions,
} from "../../../db/schema";
import { truncate, withRetry } from "../../utils";

const EMAIL_INTELLIGENCE_MODEL = "gpt-5.4-mini";
export const EMAIL_INTELLIGENCE_SCHEMA_VERSION = 1;
export const MAX_THREAD_MESSAGES = 6;
export const INLINE_PROCESS_LIMIT = 5;
export const MAX_RETRY_ATTEMPTS = 3;
export const ELIGIBILITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_SUSPICIOUS_FLAG: EmailSuspiciousFlag = {
  isSuspicious: false,
  kind: null,
  reason: null,
  confidence: null,
};

const suspiciousFlagOutputSchema = z.object({
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

/** Background email classification only */
export const emailClassificationOutputSchema = z.object({
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

export type EmailClassificationOutput = z.infer<typeof emailClassificationOutputSchema>;

export type ActiveEmailFilter = {
  id: number;
  description: string;
  actions: FilterActions;
};

export type StoredEmailClassification = {
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

function compactText(value: string | null | undefined, maxLength: number): string {
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

function normalizeSuspiciousFlag(
  suspicious: EmailClassificationOutput["suspicious"],
): EmailSuspiciousFlag {
  if (!suspicious?.isSuspicious) {
    return DEFAULT_SUSPICIOUS_FLAG;
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

export function normalizeEmailClassificationOutput(
  output: EmailClassificationOutput,
): StoredEmailClassification {
  return {
    category: output.category,
    urgency: output.urgency,
    suspicious: normalizeSuspiciousFlag(output.suspicious),
  };
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

export function buildThreadPrompt(
  email: EmailContextRow,
  threadMessages: EmailContextRow[],
  userEmail?: string | null,
) {
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

  const lines = [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    userEmail ? `User's email address: ${userEmail}` : null,
    userEmail
      ? `Always refer to ${userEmail} as "the user". Any message whose From equals ${userEmail} was sent BY the user, not to them. Any message whose To or Cc contains ${userEmail} was sent TO the user.`
      : null,
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
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
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
}) {
  const openai = createOpenAI({
    apiKey: input.env.OPENAI_API_KEY,
  });

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
}
