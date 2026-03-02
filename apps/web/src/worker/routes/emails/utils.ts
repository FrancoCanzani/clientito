import { sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { EmailListRow, EmailSearchRow } from "./type";

export function normalizeEmailAddress(input: string): string {
  return input.trim().toLowerCase();
}

export function hasEmailLabel(label: string) {
  return sql<boolean>`exists(
    select 1
    from json_each(coalesce(${emails.labelIds}, '[]'))
    where value = ${label}
  )`;
}

export function hasAnyEmailCategoryLabel() {
  return sql<boolean>`exists(
    select 1
    from json_each(coalesce(${emails.labelIds}, '[]'))
    where value like 'CATEGORY_%'
  )`;
}

export function toEmailListResponse(row: EmailListRow) {
  const labelIds = row.labelIds ?? [];

  return {
    id: String(row.id),
    gmailId: row.gmailId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    subject: row.subject,
    snippet: row.snippet,
    bodyText: row.bodyText,
    bodyHtml: row.bodyHtml,
    threadId: row.threadId,
    date: row.date,
    direction: row.direction,
    isRead: row.isRead,
    labelIds,
    hasAttachment: labelIds.includes("HAS_ATTACHMENT"),
    personId: row.personId ? String(row.personId) : null,
    createdAt: row.createdAt,
  };
}

export function toEmailSearchResponse(row: EmailSearchRow) {
  return {
    id: String(row.id),
    gmailId: row.gmailId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    subject: row.subject,
    snippet: row.snippet,
    date: row.date,
    isRead: row.isRead,
    labelIds: row.labelIds ?? [],
    personId: row.personId ? String(row.personId) : null,
  };
}
