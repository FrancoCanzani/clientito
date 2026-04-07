import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import {
  emailIntelligence,
  emails,
  type CalendarSuggestion,
  type EmailSuspiciousFlag,
} from "../../../db/schema";
import { STANDARD_LABELS } from "../types";
import {
  DEFAULT_SUSPICIOUS_FLAG,
  ELIGIBILITY_WINDOW_MS,
  MAX_THREAD_MESSAGES,
  type EmailContextRow,
  type StoredEmailClassification,
} from "./common";

type StoredClassificationRow =
  | Pick<
      typeof emailIntelligence.$inferSelect,
      | "status"
      | "category"
      | "urgency"
      | "suspiciousJson"
    >
  | null
  | undefined;

export type CalendarSuggestionMatch = {
  row: typeof emailIntelligence.$inferSelect;
  suggestion: CalendarSuggestion;
};

export function getIntelligenceStatus(
  row: Pick<typeof emailIntelligence.$inferSelect, "status"> | null | undefined,
) {
  return row?.status ?? null;
}

export function getStoredEmailClassification(
  row: StoredClassificationRow,
): StoredEmailClassification | null {
  if (!row || row.status !== "ready" || !row.category || !row.urgency) {
    return null;
  }

  return {
    category: row.category,
    urgency: row.urgency,
    suspicious: row.suspiciousJson ?? DEFAULT_SUSPICIOUS_FLAG satisfies EmailSuspiciousFlag,
  };
}

export function isEmailEligibleForIntelligence(
  email: Pick<
    EmailContextRow,
    "date" | "direction" | "labelIds" | "isRead" | "snoozedUntil"
  > & { isLatestInThread: boolean },
  now = Date.now(),
) {
  if (email.direction !== "received") return false;
  if (now - email.date > ELIGIBILITY_WINDOW_MS) return false;

  const labelIds = email.labelIds ?? [];
  if (
    labelIds.includes(STANDARD_LABELS.SPAM) ||
    labelIds.includes(STANDARD_LABELS.TRASH)
  ) {
    return false;
  }

  return (
    !email.isRead ||
    labelIds.includes(STANDARD_LABELS.INBOX) ||
    labelIds.includes(STANDARD_LABELS.STARRED) ||
    typeof email.snoozedUntil === "number" ||
    email.isLatestInThread
  );
}

export async function loadEmailContext(
  db: Database,
  emailId: number,
  userId?: string,
) {
  const emailWhere = userId
    ? and(eq(emails.id, emailId), eq(emails.userId, userId))
    : eq(emails.id, emailId);

  const emailRows = await db
    .select({
      id: emails.id,
      userId: emails.userId,
      mailboxId: emails.mailboxId,
      providerMessageId: emails.providerMessageId,
      threadId: emails.threadId,
      messageId: emails.messageId,
      fromAddr: emails.fromAddr,
      fromName: emails.fromName,
      toAddr: emails.toAddr,
      ccAddr: emails.ccAddr,
      subject: emails.subject,
      snippet: emails.snippet,
      bodyText: emails.bodyText,
      date: emails.date,
      direction: emails.direction,
      isRead: emails.isRead,
      labelIds: emails.labelIds,
      snoozedUntil: emails.snoozedUntil,
    })
    .from(emails)
    .where(emailWhere)
    .limit(1);

  const email = emailRows[0];
  if (!email) return null;

  const threadMessages = email.threadId
    ? await db
        .select({
          id: emails.id,
          userId: emails.userId,
          mailboxId: emails.mailboxId,
          providerMessageId: emails.providerMessageId,
          threadId: emails.threadId,
          messageId: emails.messageId,
          fromAddr: emails.fromAddr,
          fromName: emails.fromName,
          toAddr: emails.toAddr,
          ccAddr: emails.ccAddr,
          subject: emails.subject,
          snippet: emails.snippet,
          bodyText: emails.bodyText,
          date: emails.date,
          direction: emails.direction,
          isRead: emails.isRead,
          labelIds: emails.labelIds,
          snoozedUntil: emails.snoozedUntil,
        })
        .from(emails)
        .where(and(eq(emails.threadId, email.threadId), eq(emails.userId, email.userId)))
        .orderBy(asc(emails.date))
        .limit(MAX_THREAD_MESSAGES)
    : [email];

  return { email, threadMessages };
}

export async function findCalendarSuggestionById(
  db: Database,
  userId: string,
  suggestionId: number,
) {
  const rows = await db
    .select()
    .from(emailIntelligence)
    .where(eq(emailIntelligence.userId, userId));

  for (const row of rows) {
    const suggestion = (row.calendarEventsJson ?? []).find(
      (entry) => entry.id === suggestionId,
    );
    if (suggestion) return { row, suggestion } satisfies CalendarSuggestionMatch;
  }

  return null;
}

export async function updateCalendarSuggestion(
  db: Database,
  match: CalendarSuggestionMatch,
  update: Partial<CalendarSuggestion>,
) {
  const calendarEvents = (match.row.calendarEventsJson ?? []).map((entry) =>
    entry.id === match.suggestion.id
      ? {
          ...entry,
          ...update,
          updatedAt: Date.now(),
        }
      : entry,
  );

  await db
    .update(emailIntelligence)
    .set({
      calendarEventsJson: calendarEvents,
      updatedAt: Date.now(),
    })
    .where(eq(emailIntelligence.id, match.row.id));
}
