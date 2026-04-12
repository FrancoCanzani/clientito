import { eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { emailIntelligence, emails } from "../../../db/schema";
import { truncate } from "../../utils";
import {
  buildSourceHash,
  buildThreadPrompt,
  EMAIL_INTELLIGENCE_SCHEMA_VERSION,
  emailClassificationOutputSchema,
  generateStructuredEmailObject,
  normalizeEmailClassificationOutput,
  INLINE_PROCESS_LIMIT,
  MAX_RETRY_ATTEMPTS,
} from "./common";
import {
  getStoredEmailClassification,
  isEmailEligibleForIntelligence,
  loadEmailContext,
} from "./store";

const CLASSIFICATION_SYSTEM = [
  "## Role",
  "You are an email classifier. Classify the email for inbox surfacing.",
  "Return one JSON object matching the requested schema.",
  "",
  "## Classification",
  "- category:",
  "  - to_respond: the user must reply — a question was asked, a meeting proposed, approval requested, or a personal message expects an answer.",
  "  - to_follow_up: the user must act but not reply — pay a bill, sign a document, meet a deadline, renew a subscription. Government, tax, legal, and financial deadlines are always to_follow_up.",
  "  - fyi: informational updates the user should know about — status changes, announcements, newsletters, digests, blog roundups.",
  "  - notification: automated alerts, app notifications, social media summaries, security alerts, product updates.",
  "  - invoice: receipts, order confirmations, payment confirmations, bills, invoices, refunds, shipping notifications.",
  "  - marketing: promotional emails, sales, discounts, flash deals, product offers, company marketing campaigns.",
  "",
  "## Safety",
  "- Set isSuspicious=true only when there are concrete scam or impersonation signals (phishing links, credential harvesting, payment fraud, sender impersonation).",
  "- If the email appears normal or you are unsure, set isSuspicious=false.",
].join("\n");

export async function enqueueEmailIntelligence(
  db: Database,
  emailIds: number[],
  now = Date.now(),
) {
  if (emailIds.length === 0) return [];

  const rows = await db
    .select({
      id: emails.id,
      userId: emails.userId,
      mailboxId: emails.mailboxId,
      date: emails.date,
      direction: emails.direction,
      labelIds: emails.labelIds,
      isRead: emails.isRead,
      snoozedUntil: emails.snoozedUntil,
      threadId: emails.threadId,
    })
    .from(emails)
    .where(inArray(emails.id, emailIds));

  const threadIds = [...new Set(rows.map((row) => row.threadId).filter((id): id is string => Boolean(id)))];
  const latestThreadDates = threadIds.length
    ? await db
        .select({
          threadId: emails.threadId,
          latestDate: sql<number>`max(${emails.date})`,
        })
        .from(emails)
        .where(inArray(emails.threadId, threadIds))
        .groupBy(emails.threadId)
    : [];

  const latestDateByThread = new Map<string, number>();
  for (const row of latestThreadDates) {
    if (!row.threadId || !Number.isFinite(row.latestDate)) continue;
    latestDateByThread.set(row.threadId, row.latestDate);
  }

  const eligible = rows.filter((row) =>
    isEmailEligibleForIntelligence(
      {
        ...row,
        isLatestInThread: row.threadId
          ? latestDateByThread.get(row.threadId) === row.date
          : true,
      },
      now,
    ),
  );

  if (eligible.length === 0) return [];

  for (const row of eligible) {
    await db
      .insert(emailIntelligence)
      .values({
        emailId: row.id,
        userId: row.userId,
        mailboxId: row.mailboxId,
        status: "pending",
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [emailIntelligence.emailId],
        set: {
          mailboxId: row.mailboxId,
          status: "pending",
          error: null,
          updatedAt: now,
        },
      });
  }

  return eligible.map((row) => row.id);
}

async function processEmailIntelligence(
  db: Database,
  env: Env,
  emailId: number,
) {
  const context = await loadEmailContext(db, emailId);
  if (!context) return null;

  const { email, threadMessages } = context;
  const now = Date.now();
  const nextSourceHash = await buildSourceHash(email, threadMessages);

  const existingRows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.emailId, emailId))
    .limit(1);

  const existing = existingRows[0] ?? null;

  if (
    existing?.status === "ready" &&
    existing.sourceHash === nextSourceHash &&
    existing.category
  ) {
    return getStoredEmailClassification(existing);
  }

  await db
    .insert(emailIntelligence)
    .values({
      emailId,
      userId: email.userId,
      mailboxId: email.mailboxId,
      status: "pending",
      sourceHash: nextSourceHash,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailIntelligence.emailId],
      set: {
        mailboxId: email.mailboxId,
        status: "pending",
        sourceHash: nextSourceHash,
        attemptCount: (existing?.attemptCount ?? 0) + 1,
        updatedAt: now,
      },
    });

  try {
    const prompt = buildThreadPrompt(email, threadMessages);

    const result = await generateStructuredEmailObject({
      env,
      prompt,
      system: CLASSIFICATION_SYSTEM,
      schema: emailClassificationOutputSchema,
    });
    const classification = normalizeEmailClassificationOutput(result.object);

    const contentChanged = existing?.sourceHash !== nextSourceHash;

    await db
      .update(emailIntelligence)
      .set({
        mailboxId: email.mailboxId,
        category: classification.category,
        suspiciousJson: { isSuspicious: classification.isSuspicious },
        // Clear stale on-demand data only when email content changed
        ...(contentChanged ? { summary: null, actionsJson: [] } : {}),
        status: "ready",
        sourceHash: nextSourceHash,
        model: result.model,
        schemaVersion: EMAIL_INTELLIGENCE_SCHEMA_VERSION,
        error: null,
        lastProcessedAt: now,
        updatedAt: now,
      })
      .where(eq(emailIntelligence.emailId, emailId));

    const latest = await db
      .select()
      .from(emailIntelligence)
      .where(eq(emailIntelligence.emailId, emailId))
      .limit(1);

    return getStoredEmailClassification(latest[0]);
  } catch (error) {
    await db
      .update(emailIntelligence)
      .set({
        status: "error",
        error: error instanceof Error ? truncate(error.message, 500) : "Unknown error",
        lastProcessedAt: now,
        updatedAt: now,
      })
      .where(eq(emailIntelligence.emailId, emailId));

    throw error;
  }
}

export async function processPendingEmailIntelligence(
  db: Database,
  env: Env,
  limit = 20,
) {
  const rows = await db
    .select({
      emailId: emailIntelligence.emailId,
      attemptCount: emailIntelligence.attemptCount,
    })
    .from(emailIntelligence)
    .where(
      or(
        eq(emailIntelligence.status, "pending"),
        eq(emailIntelligence.status, "error"),
      ),
    )
    .orderBy(emailIntelligence.createdAt)
    .limit(limit);

  let processed = 0;
  for (const row of rows) {
    if (row.attemptCount >= MAX_RETRY_ATTEMPTS) continue;
    try {
      await processEmailIntelligence(db, env, row.emailId);
      processed += 1;
    } catch (error) {
      console.error("Pending email classification failed", { emailId: row.emailId, error });
    }
  }

  return processed;
}

export async function processInlineEmailIntelligence(
  db: Database,
  env: Env,
  emailIds: number[],
  limit = INLINE_PROCESS_LIMIT,
) {
  const candidates = emailIds.slice(0, limit);
  await Promise.allSettled(
    candidates.map((emailId) => processEmailIntelligence(db, env, emailId)),
  );
}
