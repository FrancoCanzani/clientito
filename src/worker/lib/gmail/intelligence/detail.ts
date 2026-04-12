import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../db/client";
import type { EmailAction } from "../../../db/schema";
import { emailIntelligence, mailboxes } from "../../../db/schema";
import { truncate } from "../../utils";
import {
  EMAIL_INTELLIGENCE_SCHEMA_VERSION,
  buildSourceHash,
  buildThreadPrompt,
  generateStructuredEmailObject,
} from "./common";
import { loadEmailContext } from "./store";

const ON_DEMAND_SYSTEM = [
  "You are an email assistant analyzing an inbox on behalf of a specific user.",
  "The prompt identifies the user's email address; any message from that address was written BY the user, and any message to that address was sent TO the user.",
  "Write summaries from the user's perspective, never address the user in the third person, and never confuse the sender with the recipient.",
  "Return a JSON object with:",
  "- summary: 1-2 sentences describing what is being asked of the user or what the user needs to know. Be specific — include names, amounts, and deadlines.",
  "- replyDraft: a short plain-text reply the user could send, if a human personal response is clearly expected. null for newsletters, automated notifications, receipts, or any email not requiring a personal reply.",
].join(" ");

const emailOnDemandOutputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  replyDraft: z.string().trim().max(2000).nullable(),
});

type EmailOnDemandOutput = z.infer<typeof emailOnDemandOutputSchema>;

export type EmailOnDemandResult = {
  summary: string | null;
  isSuspicious: boolean;
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
  suspiciousJson: { isSuspicious: boolean } | null;
  actionsJson: EmailAction[] | null;
}): EmailOnDemandResult {
  const replyAction = (row.actionsJson ?? []).find(
    (action) => action.type === "reply" && action.status === "pending",
  );

  return {
    summary: row.summary,
    isSuspicious: row.suspiciousJson?.isSuspicious ?? false,
    replyDraft:
      typeof replyAction?.payload.draft === "string"
        ? replyAction.payload.draft
        : null,
  };
}

function hasOnDemandContent(result: EmailOnDemandResult): boolean {
  return Boolean(result.summary || result.replyDraft || result.isSuspicious);
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

  let userEmail: string | null = null;
  if (email.mailboxId != null) {
    const mailboxRows = await db
      .select({ email: mailboxes.email })
      .from(mailboxes)
      .where(eq(mailboxes.id, email.mailboxId))
      .limit(1);
    userEmail = mailboxRows[0]?.email ?? null;
  }

  const prompt = buildThreadPrompt(email, threadMessages, userEmail);
  const { object, model } = await generateStructuredEmailObject({
    env,
    prompt,
    system: ON_DEMAND_SYSTEM,
    schema: emailOnDemandOutputSchema,
  });

  const normalized = normalizeOnDemandOutput(emailId, object, now);
  const isSuspicious = existing?.suspiciousJson?.isSuspicious ?? false;

  await db
    .insert(emailIntelligence)
    .values({
      emailId,
      userId: email.userId,
      mailboxId: email.mailboxId,
      status: existing?.status ?? "pending",
      summary: normalized.summary,
      suspiciousJson: { isSuspicious },
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
    isSuspicious,
    replyDraft: normalized.replyDraft,
  };
}
