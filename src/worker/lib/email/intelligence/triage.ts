import { desc, eq, inArray, or } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { emailIntelligence, emails, type EmailAction, type FilterActions } from "../../../db/schema";
import { applyEmailPatch } from "../../../routes/inbox/emails/internal/mutation";
import { truncate } from "../../utils";
import { createEmailProvider } from "../index";
import { getUserFilters } from "../user-filters";
import {
  buildFilterPrompt,
  buildSharedActionRules,
  buildSourceHash,
  buildThreadPrompt,
  EMAIL_INTELLIGENCE_SCHEMA_VERSION,
  emailTriageOutputSchema,
  generateStructuredEmailObject,
  INLINE_PROCESS_LIMIT,
  MAX_RETRY_ATTEMPTS,
  normalizeEmailTriageOutput,
  normalizeMatchedFilterIds,
  type ActiveEmailFilter,
  type EmailContextRow,
} from "./common";
import {
  getStoredEmailTriage,
  isEmailEligibleForIntelligence,
  loadEmailContext,
} from "./store";

const TRIAGE_SYSTEM = [
  "## Role",
  "You are an email triage assistant. Classify the email for inbox surfacing and home briefing, not deep detail view.",
  "Return one JSON object matching the requested schema.",
  "",
  "## Classification",
  "- category:",
  "  - action_needed: the user must do something — pay, reply, sign, approve, renew, or meet a deadline. Government, tax, legal, and financial deadlines are always action_needed.",
  "  - important: high-value updates the user should know about but that don't require a response (e.g. shipping confirmations, account security alerts, personal messages that are FYI).",
  "  - notification: automated alerts, status updates, policy changes, product announcements. Most bulk emails from companies (GitHub, services, platforms) are notifications, NOT important.",
  "  - newsletter: recurring content digests, blog roundups, marketing.",
  "  - transactional: receipts, order confirmations, password resets.",
  "- urgency: high for items with a deadline within 7 days or needing attention today, medium for items needing attention this week, low for informational.",
  "- briefingSentence: 1-2 sentences summarizing what the sender wants and why it matters, or null if the email is routine. Be specific — include names, dates, and amounts when relevant.",
  "- Be consistent: if you see the same sender and same type of email, classify it the same way every time.",
  "",
  buildSharedActionRules(),
  "",
  "## Calendar Events",
  "- calendarEvents: only include high-signal date or meeting suggestions with enough detail to present to the user.",
  "",
  "## Filter Matching",
  "- matchedFilterIds: include only the provided filter IDs that clearly match this email.",
  "- If no provided filters clearly match, return an empty array.",
].join("\n");

async function generateEmailTriage(
  env: Env,
  prompt: string,
  filters: ActiveEmailFilter[],
) {
  const result = await generateStructuredEmailObject({
    env,
    prompt,
    system: TRIAGE_SYSTEM,
    schema: emailTriageOutputSchema,
  });

  return {
    output: result.object,
    matchedFilterIds: normalizeMatchedFilterIds(
      result.object.matchedFilterIds,
      filters,
    ),
    model: result.model,
  };
}

async function updateEmailActionExecution(
  db: Database,
  env: Env,
  email: EmailContextRow,
  action: EmailAction,
) {
  if (!email.mailboxId) {
    return {
      ...action,
      status: "failed" as const,
      error: "Missing mailbox",
      updatedAt: Date.now(),
    };
  }

  if (action.type === "archive") {
    const provider = await createEmailProvider(db, env, email.mailboxId);
    const nextState = applyEmailPatch(email, { archived: true, isRead: true });
    if (nextState.addLabelIds.length > 0 || nextState.removeLabelIds.length > 0) {
      await provider.modifyLabels(
        [email.providerMessageId],
        nextState.addLabelIds,
        nextState.removeLabelIds,
      );
    }

    await db.update(emails).set(nextState.dbUpdates).where(eq(emails.id, email.id));

    return {
      ...action,
      status: "executed" as const,
      error: null,
      executedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (action.type === "snooze" && typeof action.payload.until === "number") {
    await db
      .update(emails)
      .set({ snoozedUntil: action.payload.until })
      .where(eq(emails.id, email.id));

    return {
      ...action,
      status: "executed" as const,
      error: null,
      executedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  return action;
}

async function applyFilterActions(
  db: Database,
  env: Env,
  email: EmailContextRow,
  filters: ActiveEmailFilter[],
) {
  const matchedFilters = filters.filter(
    (filter) => Boolean(filter.actions) && Object.keys(filter.actions).length > 0,
  );
  if (matchedFilters.length === 0) {
    return { email, categoryOverride: null as FilterActions["applyCategory"] | null };
  }

  let categoryOverride: FilterActions["applyCategory"] | null = null;
  const mutation: Parameters<typeof applyEmailPatch>[1] = {};

  for (const filter of matchedFilters) {
    if (filter.actions.markRead) mutation.isRead = true;
    if (filter.actions.archive) mutation.archived = true;
    if (filter.actions.trash) mutation.trashed = true;
    if (filter.actions.star) mutation.starred = true;
    if (filter.actions.applyCategory) {
      categoryOverride = filter.actions.applyCategory;
    }
  }

  if (Object.keys(mutation).length === 0) {
    return { email, categoryOverride };
  }

  const patch = applyEmailPatch(email, mutation);
  if (Object.keys(patch.dbUpdates).length > 0) {
    await db.update(emails).set(patch.dbUpdates).where(eq(emails.id, email.id));
  }

  if (
    email.mailboxId &&
    (patch.addLabelIds.length > 0 || patch.removeLabelIds.length > 0)
  ) {
    const provider = await createEmailProvider(db, env, email.mailboxId);
    await provider.modifyLabels(
      [email.providerMessageId],
      patch.addLabelIds,
      patch.removeLabelIds,
    );
  }

  return {
    email: {
      ...email,
      ...patch.dbUpdates,
      labelIds: patch.labelIds,
      isRead:
        typeof patch.dbUpdates.isRead === "boolean"
          ? patch.dbUpdates.isRead
          : email.isRead,
      snoozedUntil:
        typeof patch.dbUpdates.snoozedUntil === "number" ||
        patch.dbUpdates.snoozedUntil === null
          ? patch.dbUpdates.snoozedUntil
          : email.snoozedUntil,
    },
    categoryOverride,
  };
}

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
  const latestThreadRows = threadIds.length
    ? await db
        .select({
          id: emails.id,
          threadId: emails.threadId,
        })
        .from(emails)
        .where(inArray(emails.threadId, threadIds))
        .orderBy(desc(emails.date))
    : [];

  const latestByThread = new Map<string, number>();
  for (const row of latestThreadRows) {
    if (!row.threadId || latestByThread.has(row.threadId)) continue;
    latestByThread.set(row.threadId, row.id);
  }

  const eligible = rows.filter((row) =>
    isEmailEligibleForIntelligence(
      {
        ...row,
        isLatestInThread: row.threadId
          ? latestByThread.get(row.threadId) === row.id
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

export async function processEmailIntelligence(
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
    existing.category &&
    existing.urgency
  ) {
    return getStoredEmailTriage(existing);
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
    const activeFilters = await getUserFilters(db, email.userId);
    const prompt = [buildThreadPrompt(email, threadMessages), buildFilterPrompt(activeFilters)]
      .filter(Boolean)
      .join("\n");
    const { output, matchedFilterIds, model } = await generateEmailTriage(
      env,
      prompt,
      activeFilters,
    );
    const normalized = normalizeEmailTriageOutput(emailId, output, now);
    const { email: nextEmail, categoryOverride } = await applyFilterActions(
      db,
      env,
      email,
      activeFilters.filter((filter) => matchedFilterIds.includes(filter.id)),
    );
    const category = categoryOverride ?? normalized.category;

    const actions: EmailAction[] = [];
    for (const action of normalized.actions) {
      if (action.trustLevel === "auto") {
        try {
          actions.push(await updateEmailActionExecution(db, env, nextEmail, action));
        } catch (error) {
          actions.push({
            ...action,
            status: "failed",
            error: error instanceof Error ? error.message : "Action failed",
            updatedAt: Date.now(),
          });
        }
      } else {
        actions.push(action);
      }
    }

    await db
      .update(emailIntelligence)
      .set({
        mailboxId: nextEmail.mailboxId,
        category,
        urgency: output.urgency,
        summary: null,
        briefingSentence: normalized.briefingSentence,
        actionsJson: actions,
        calendarEventsJson: normalized.calendarEvents,
        status: "ready",
        sourceHash: nextSourceHash,
        model,
        schemaVersion: EMAIL_INTELLIGENCE_SCHEMA_VERSION,
        error: null,
        lastProcessedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(emailIntelligence.emailId, emailId));

    const latest = await db
      .select()
      .from(emailIntelligence)
      .where(eq(emailIntelligence.emailId, emailId))
      .limit(1);

    return getStoredEmailTriage(latest[0]);
  } catch (error) {
    await db
      .update(emailIntelligence)
      .set({
        status: "error",
        error:
          error instanceof Error ? truncate(error.message, 500) : "Unknown error",
        lastProcessedAt: Date.now(),
        updatedAt: Date.now(),
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
    .orderBy(emailIntelligence.updatedAt)
    .limit(limit);

  let processed = 0;
  for (const row of rows) {
    if (row.attemptCount >= MAX_RETRY_ATTEMPTS) continue;
    try {
      await processEmailIntelligence(db, env, row.emailId);
      processed += 1;
    } catch (error) {
      console.error("Pending email triage failed", {
        emailId: row.emailId,
        error,
      });
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
