import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../db/client";
import type { EmailAction, EmailSuspiciousFlag } from "../../../db/schema";
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
].join(" ");

const emailOnDemandOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  replyDraft: z.string().trim().max(2000).nullable(),
});

type EmailOnDemandOutput = z.infer<typeof emailOnDemandOutputSchema>;

export type EmailOnDemandResult = {
  summary: string | null;
  suspicious: EmailSuspiciousFlag;
  replyDraft: string | null;
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
}): EmailOnDemandResult {
  const replyAction = (row.actionsJson ?? []).find(
    (action) => action.type === "reply" && action.status === "pending",
  );

  return {
    summary: row.summary,
    suspicious: row.suspiciousJson ?? DEFAULT_SUSPICIOUS_FLAG,
    replyDraft:
      typeof replyAction?.payload.draft === "string"
        ? replyAction.payload.draft
        : null,
  };
}

function hasOnDemandContent(result: EmailOnDemandResult): boolean {
  return Boolean(result.summary || result.replyDraft || result.suspicious.isSuspicious);
}

function normalizeOnDemandOutput(
  emailId: number,
  output: EmailOnDemandOutput,
  now: number,
): {
  summary: string;
  actions: EmailAction[];
  replyDraft: string | null;
} {
  const summary = truncate(output.summary.replace(/\s+/g, " ").trim(), 500);
  const replyDraft = output.replyDraft?.trim()
    ? truncate(output.replyDraft.trim(), 2000)
    : null;

  const actions: EmailAction[] = replyDraft
    ? [
        {
          id: `reply-${emailId}`,
          type: "reply",
          label: "Reply",
          payload: { draft: replyDraft },
          trustLevel: "approve",
          status: "pending",
          error: null,
          executedAt: null,
          updatedAt: now,
        },
      ]
    : [];

  return { summary, actions, replyDraft };
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
  };
}
