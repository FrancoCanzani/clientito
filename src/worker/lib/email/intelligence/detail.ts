import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { emailIntelligence } from "../../../db/schema";
import {
  buildSourceHash,
  compactText,
  deriveActionBuckets,
  EMAIL_INTELLIGENCE_MODEL,
  type EmailDetailIntelligence,
} from "./common";
import { loadEmailContext } from "./store";

export const SUMMARY_SYSTEM = [
  "You are an email detail assistant.",
  "Write a 1-2 sentence summary describing what the sender wants and what is at stake.",
  "Be specific — include names, dates, amounts, and deadlines when present.",
  "Output ONLY the summary text, no JSON, no markdown, no labels.",
].join(" ");

export function buildSummaryPrompt(
  email: { fromName: string | null; fromAddr: string; subject: string | null; bodyText: string | null },
  threadMessages: { fromAddr: string; fromName: string | null; subject: string | null; bodyText: string | null; date: number }[],
) {
  const parts = threadMessages.map((msg, i) => {
    const sender = msg.fromName?.trim() || msg.fromAddr;
    const body = compactText(msg.bodyText, 1800) || "(empty)";
    return `Message ${i + 1}\nFrom: ${sender}\nSubject: ${msg.subject ?? "(no subject)"}\nBody: ${body}`;
  });

  return [
    `From: ${email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr}`,
    `Subject: ${email.subject ?? "(no subject)"}`,
    "",
    ...parts,
  ].join("\n");
}

export async function getEmailDetailCached(
  db: Database,
  emailId: number,
): Promise<(Omit<EmailDetailIntelligence, "summary"> & { summary: string | null }) | null> {
  const existingRows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const existing = existingRows[0] ?? null;

  if (!existing || existing.status !== "ready") return null;

  const actions = existing.actionsJson ?? [];
  return {
    summary: existing.summary,
    suspicious: existing.suspiciousJson ?? {
      isSuspicious: false,
      kind: null,
      reason: null,
      confidence: null,
    },
    actions,
    calendarEvents: existing.calendarEventsJson ?? [],
    ...deriveActionBuckets(actions),
  };
}

export async function getOrGenerateSummary(
  db: Database,
  emailId: number,
): Promise<{ summary: string | null; prompt: string | null }> {
  const existingRows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const existing = existingRows[0] ?? null;

  if (existing?.summary) {
    return { summary: existing.summary, prompt: null };
  }

  const context = await loadEmailContext(db, emailId);
  if (!context) return { summary: null, prompt: null };

  const { email, threadMessages } = context;
  const sourceHash = await buildSourceHash(email, threadMessages);
  const prompt = buildSummaryPrompt(email, threadMessages);

  if (existing && !existing.sourceHash) {
    await db
      .update(emailIntelligence)
      .set({ sourceHash, updatedAt: Date.now() })
      .where(eq(emailIntelligence.emailId, emailId));
  }

  return { summary: null, prompt };
}

export async function saveSummary(
  db: Database,
  emailId: number,
  summary: string,
) {
  await db
    .update(emailIntelligence)
    .set({ summary, updatedAt: Date.now() })
    .where(eq(emailIntelligence.emailId, emailId));
}

export async function generateEmailDetailIntelligence(
  db: Database,
  env: Env,
  emailId: number,
): Promise<(Omit<EmailDetailIntelligence, "summary"> & { summary: string | null }) | null> {
  const cached = await getEmailDetailCached(db, emailId);
  const { summary, prompt } = await getOrGenerateSummary(db, emailId);

  let resolvedSummary = summary;

  if (!resolvedSummary && prompt) {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const result = await generateText({
      model: openai(EMAIL_INTELLIGENCE_MODEL),
      system: SUMMARY_SYSTEM,
      prompt,
      maxOutputTokens: 200,
    });

    const text = result.text.trim();
    if (text) {
      await saveSummary(db, emailId, text);
      resolvedSummary = text;
    }
  }

  return {
    summary: resolvedSummary ?? null,
    suspicious: cached?.suspicious ?? {
      isSuspicious: false,
      kind: null,
      reason: null,
      confidence: null,
    },
    actions: cached?.actions ?? [],
    calendarEvents: cached?.calendarEvents ?? [],
    autoExecute: cached?.autoExecute ?? [],
    requiresApproval: cached?.requiresApproval ?? [],
  };
}
