import { pendingSubset } from "./pending-lock";
import { dbClient, type ExecResult } from "./worker-client";
import type {
  DraftAttachmentKey,
  DraftRow,
  EmailAICategory,
  EmailInsert,
  LabelInsert,
  SplitRule,
  SplitViewRow,
} from "./schema";
export type { EmailInsert } from "./schema";

type LocalEmailPatch = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
  snoozedUntil?: number | null;
  labelIds?: string[] | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
};

type ViewFilter =
  | "inbox"
  | "sent"
  | "spam"
  | "trash"
  | "snoozed"
  | "archived"
  | "starred"
  | "important"
  | (string & {});

type BindParam = string | number | boolean | null | Uint8Array;

type EmailRowDb = {
  id: number;
  mailboxId: number | null;
  providerMessageId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: number;
  labelIds: string | null;
  hasInbox: number;
  hasSent: number;
  hasTrash: number;
  hasSpam: number;
  hasStarred: number;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  aiCategory: EmailAICategory | null;
  aiConfidence: number | null;
  aiReason: string | null;
  aiSummary: string | null;
  aiDraftReply: string | null;
  aiClassifiedAt: number | null;
  aiClassificationKey: string | null;
  hasCalendar: number;
  isGatekept: number;
  bodyText?: string | null;
  bodyHtml?: string | null;
  inlineAttachments?: string | null;
  attachments?: string | null;
};

const STANDARD_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  SPAM: "SPAM",
  TRASH: "TRASH",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
} as const;

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";
const LEGACY_PARTIAL_CLASSIFICATION_REASON =
  "Model classified thread using partial signal.";

const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function normalizeSender(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const candidate = bracketMatch?.[1]?.trim() ?? normalized;
  const emailMatch = candidate.match(/[^\s<>()"'`,;:]+@[^\s<>()"'`,;:]+/);
  if (!emailMatch) return null;
  return emailMatch[0].toLowerCase();
}

function rowsToObjects<T>(res: ExecResult): T[] {
  const keys = res.columns.map(snakeToCamel);
  return res.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) obj[keys[i]!] = row[i];
    return obj as T;
  });
}

function firstRow<T>(res: ExecResult): T | null {
  const rows = rowsToObjects<T>(res);
  return rows[0] ?? null;
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseLabelIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type LocalInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

function parseInlineAttachments(
  raw: string | null | undefined,
): LocalInlineAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
      .map((entry) => ({
        contentId: String(entry.contentId ?? ""),
        attachmentId: String(entry.attachmentId ?? ""),
        mimeType:
          typeof entry.mimeType === "string" ? entry.mimeType : null,
        filename:
          typeof entry.filename === "string" ? entry.filename : null,
      }))
      .filter((a) => a.contentId && a.attachmentId);
  } catch {
    return [];
  }
}

type LocalAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

function parseAttachments(
  raw: string | null | undefined,
): LocalAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
      .map((entry) => ({
        attachmentId: String(entry.attachmentId ?? ""),
        filename:
          typeof entry.filename === "string" ? entry.filename : null,
        mimeType:
          typeof entry.mimeType === "string" ? entry.mimeType : null,
        size:
          typeof entry.size === "number" && Number.isFinite(entry.size)
            ? entry.size
            : null,
        contentId:
          typeof entry.contentId === "string" ? entry.contentId : null,
        isInline: Boolean(entry.isInline),
        isImage: Boolean(entry.isImage),
      }))
      .filter((a) => a.attachmentId);
  } catch {
    return [];
  }
}

function buildAttachmentUrl(
  a: LocalAttachment,
  providerMessageId: string,
  mailboxId: number | null,
  inline: boolean,
): string | null {
  if (!providerMessageId || mailboxId == null) return null;
  const params = new URLSearchParams({
    providerMessageId,
    attachmentId: a.attachmentId,
    mailboxId: String(mailboxId),
  });
  if (inline) params.set("inline", "true");
  if (a.mimeType) params.set("mimeType", a.mimeType);
  if (a.filename) params.set("filename", a.filename);
  return `/api/inbox/emails/attachment?${params.toString()}`;
}

function toEmailAttachments(
  raw: string | null | undefined,
  providerMessageId: string,
  mailboxId: number | null,
) {
  return parseAttachments(raw).map((a) => ({
    attachmentId: a.attachmentId,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    contentId: a.contentId,
    isInline: a.isInline,
    isImage: a.isImage,
    downloadUrl:
      buildAttachmentUrl(a, providerMessageId, mailboxId, false) ?? "",
    inlineUrl: a.isInline
      ? buildAttachmentUrl(a, providerMessageId, mailboxId, true)
      : null,
  }));
}

function labelBooleans(labelIds: string[]) {
  const labels = new Set(labelIds);
  return {
    hasInbox: labels.has(STANDARD_LABELS.INBOX),
    hasSent: labels.has(STANDARD_LABELS.SENT),
    hasTrash: labels.has(STANDARD_LABELS.TRASH),
    hasSpam: labels.has(STANDARD_LABELS.SPAM),
    hasStarred: labels.has(STANDARD_LABELS.STARRED),
  };
}

function areLabelIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, i) => value === right[i]);
}

type EmailUpdateSet = {
  isRead?: boolean;
  labelIds?: string;
  hasInbox?: boolean;
  hasSent?: boolean;
  hasTrash?: boolean;
  hasSpam?: boolean;
  hasStarred?: boolean;
  snoozedUntil?: number | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
};

function applyEmailPatch(
  current: { isRead: boolean; labelIds: string | null; snoozedUntil: number | null },
  patch: LocalEmailPatch,
): EmailUpdateSet {
  const currentLabelIds = parseLabelIds(current.labelIds);
  const nextLabelIds = new Set(currentLabelIds);
  const updates: EmailUpdateSet = {};

  const queueAdd = (labelId: string) => nextLabelIds.add(labelId);
  const queueRemove = (labelId: string) => nextLabelIds.delete(labelId);

  if (patch.isRead !== undefined && patch.isRead !== current.isRead) {
    updates.isRead = patch.isRead;
    if (patch.isRead) queueRemove(STANDARD_LABELS.UNREAD);
    else queueAdd(STANDARD_LABELS.UNREAD);
  }

  if (patch.archived !== undefined) {
    if (patch.archived) {
      queueRemove(STANDARD_LABELS.INBOX);
    } else if (
      !nextLabelIds.has(STANDARD_LABELS.TRASH) &&
      !nextLabelIds.has(STANDARD_LABELS.SPAM)
    ) {
      queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (patch.trashed !== undefined) {
    if (patch.trashed) {
      queueAdd(STANDARD_LABELS.TRASH);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.SPAM);
    } else {
      queueRemove(STANDARD_LABELS.TRASH);
      if (!nextLabelIds.has(STANDARD_LABELS.SPAM)) queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (patch.spam !== undefined) {
    if (patch.spam) {
      queueAdd(STANDARD_LABELS.SPAM);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.TRASH);
    } else {
      queueRemove(STANDARD_LABELS.SPAM);
      if (!nextLabelIds.has(STANDARD_LABELS.TRASH)) queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (patch.starred !== undefined) {
    if (patch.starred) queueAdd(STANDARD_LABELS.STARRED);
    else queueRemove(STANDARD_LABELS.STARRED);
  }

  if (patch.snoozedUntil !== undefined) updates.snoozedUntil = patch.snoozedUntil;
  if (patch.bodyText !== undefined) updates.bodyText = patch.bodyText;
  if (patch.bodyHtml !== undefined) updates.bodyHtml = patch.bodyHtml;

  if (patch.labelIds !== undefined) {
    const resolved = patch.labelIds ?? [];
    updates.labelIds = JSON.stringify(resolved);
    Object.assign(updates, labelBooleans(resolved));
    return updates;
  }

  const resolvedLabelIds = Array.from(nextLabelIds);
  if (!areLabelIdsEqual(currentLabelIds, resolvedLabelIds)) {
    updates.labelIds = JSON.stringify(resolvedLabelIds);
    Object.assign(updates, labelBooleans(resolvedLabelIds));
  }

  return updates;
}

const EMAIL_COL_MAP: Record<keyof EmailUpdateSet, string> = {
  isRead: "is_read",
  labelIds: "label_ids",
  hasInbox: "has_inbox",
  hasSent: "has_sent",
  hasTrash: "has_trash",
  hasSpam: "has_spam",
  hasStarred: "has_starred",
  snoozedUntil: "snoozed_until",
  bodyText: "body_text",
  bodyHtml: "body_html",
};

function buildEmailUpdate(updates: EmailUpdateSet): {
  setClause: string;
  params: BindParam[];
} | null {
  const parts: string[] = [];
  const params: BindParam[] = [];
  for (const key of Object.keys(updates) as Array<keyof EmailUpdateSet>) {
    const col = EMAIL_COL_MAP[key];
    if (!col) continue;
    const value = updates[key];
    if (value === undefined) continue;
    parts.push(`${col} = ?`);
    params.push(value as BindParam);
  }
  if (parts.length === 0) return null;
  return { setClause: parts.join(", "), params };
}

type SqlFragment = { sql: string; params: BindParam[] };

function buildViewConditions(view: ViewFilter, now: number): SqlFragment[] {
  switch (view) {
    case "inbox":
      return [
        { sql: "has_inbox = 1", params: [] },
        { sql: "(snoozed_until IS NULL OR snoozed_until <= ?)", params: [now] },
      ];
    case "sent":
      return [{ sql: "has_sent = 1", params: [] }];
    case "spam":
      return [{ sql: "has_spam = 1", params: [] }];
    case "trash":
      return [{ sql: "has_trash = 1", params: [] }];
    case "snoozed":
      return [{ sql: "snoozed_until > ?", params: [now] }];
    case "archived":
      return [
        { sql: "has_inbox = 0", params: [] },
        { sql: "has_sent = 0", params: [] },
        { sql: "has_trash = 0", params: [] },
        { sql: "has_spam = 0", params: [] },
      ];
    case "starred":
      return [{ sql: "has_starred = 1", params: [] }];
    case "important":
      return [
        { sql: "has_inbox = 1", params: [] },
        { sql: "(snoozed_until IS NULL OR snoozed_until <= ?)", params: [now] },
        {
          sql: "EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = ?)",
          params: ["IMPORTANT"],
        },
      ];
    default:
      if (typeof view === "string" && view.startsWith("Label_")) {
        return [
          {
            sql: "EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = ?)",
            params: [view],
          },
        ];
      }
      return [];
  }
}

function buildSplitRuleConditions(rule: SplitRule): SqlFragment[] {
  const fragments: SqlFragment[] = [];

  if (rule.domains?.length) {
    const cleaned = rule.domains
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      const clauses = cleaned.map(() => "LOWER(from_addr) LIKE ?");
      fragments.push({
        sql: `(${clauses.join(" OR ")})`,
        params: cleaned.map((d) => `%@${d}`),
      });
    }
  }

  if (rule.senders?.length) {
    const cleaned = rule.senders.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length) {
      const clauses = cleaned
        .map(() => "(LOWER(from_addr) LIKE ? OR LOWER(from_name) LIKE ?)")
        .join(" OR ");
      const params: BindParam[] = [];
      for (const s of cleaned) {
        const needle = `%${s.toLowerCase()}%`;
        params.push(needle, needle);
      }
      fragments.push({ sql: `(${clauses})`, params });
    }
  }

  if (rule.recipients?.length) {
    const cleaned = rule.recipients
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      const clauses = cleaned.map(() => "LOWER(to_addr) LIKE ?").join(" OR ");
      fragments.push({
        sql: `(${clauses})`,
        params: cleaned.map((r) => `%${r}%`),
      });
    }
  }

  if (rule.subjectContains?.length) {
    const cleaned = rule.subjectContains
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      const clauses = cleaned.map(() => "LOWER(subject) LIKE ?").join(" OR ");
      fragments.push({
        sql: `(${clauses})`,
        params: cleaned.map((s) => `%${s}%`),
      });
    }
  }

  if (rule.hasAttachment === true) {
    fragments.push({
      sql: "EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = ?)",
      params: [HAS_ATTACHMENT_LABEL],
    });
  } else if (rule.hasAttachment === false) {
    fragments.push({
      sql: "NOT EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = ?)",
      params: [HAS_ATTACHMENT_LABEL],
    });
  }

  if (rule.fromMailingList === true) {
    fragments.push({
      sql: "(unsubscribe_url IS NOT NULL OR unsubscribe_email IS NOT NULL)",
      params: [],
    });
  } else if (rule.fromMailingList === false) {
    fragments.push({
      sql: "(unsubscribe_url IS NULL AND unsubscribe_email IS NULL)",
      params: [],
    });
  }

  if (rule.gmailLabels?.length) {
    const labels = rule.gmailLabels.filter(Boolean);
    if (labels.length) {
      const placeholders = labels.map(() => "?").join(", ");
      fragments.push({
        sql: `EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value IN (${placeholders}))`,
        params: labels,
      });
    }
  }

  return fragments;
}

const EMAIL_SUMMARY_SELECT = `
  id,
  mailbox_id,
  provider_message_id,
  from_addr,
  from_name,
  to_addr,
  cc_addr,
  subject,
  snippet,
  thread_id,
  date,
  direction,
  is_read,
  label_ids,
  has_inbox,
  has_sent,
  has_trash,
  has_spam,
  has_starred,
  created_at,
  unsubscribe_url,
  unsubscribe_email,
  snoozed_until,
  has_calendar,
  is_gatekept,
  ai_category,
  ai_confidence,
  ai_reason,
  ai_summary,
  ai_draft_reply,
  ai_classified_at,
  ai_classification_key
`;

function toEmailListItem(row: EmailRowDb) {
  const labelIds = parseLabelIds(row.labelIds);
  const aiReason =
    row.aiReason?.trim() === LEGACY_PARTIAL_CLASSIFICATION_REASON
      ? null
      : row.aiReason ?? null;
  return {
    id: String(row.id),
    mailboxId: row.mailboxId,
    providerMessageId: row.providerMessageId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    ccAddr: row.ccAddr,
    subject: row.subject,
    snippet: row.snippet,
    threadId: row.threadId,
    date: row.date,
    direction: row.direction,
    isRead: toBool(row.isRead),
    labelIds,
    hasAttachment: labelIds.includes(HAS_ATTACHMENT_LABEL),
    createdAt: row.createdAt,
    unsubscribeUrl: row.unsubscribeUrl,
    unsubscribeEmail: row.unsubscribeEmail,
    snoozedUntil: row.snoozedUntil,
    hasCalendar: toBool(row.hasCalendar),
    isGatekept: toBool(row.isGatekept),
    aiCategory: row.aiCategory ?? null,
    aiConfidence:
      typeof row.aiConfidence === "number"
        ? row.aiConfidence
        : row.aiConfidence == null
          ? null
          : Number(row.aiConfidence),
    aiReason,
    aiSummary: row.aiSummary ?? null,
    aiDraftReply: row.aiDraftReply ?? null,
    aiClassifiedAt: row.aiClassifiedAt ?? null,
  };
}

function composeWhere(fragments: SqlFragment[]): {
  where: string;
  params: BindParam[];
} {
  const nonEmpty = fragments.filter((f) => f.sql.length > 0);
  if (nonEmpty.length === 0) return { where: "", params: [] };
  return {
    where: "WHERE " + nonEmpty.map((f) => f.sql).join(" AND "),
    params: nonEmpty.flatMap((f) => f.params),
  };
}

function boolParam(v: boolean): 0 | 1 {
  return v ? 1 : 0;
}

function normalizeLabelIds(raw: string | string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (typeof raw === "string") return parseLabelIds(raw);
  return raw;
}

async function updateEmailByIds(
  userId: string,
  emailIds: number[],
  set: EmailUpdateSet,
): Promise<void> {
  const update = buildEmailUpdate(set);
  if (!update) return;
  if (emailIds.length === 0) return;
  const placeholders = emailIds.map(() => "?").join(", ");
  await dbClient.exec(
    `UPDATE emails SET ${update.setClause} WHERE user_id = ? AND id IN (${placeholders})`,
    [...update.params, userId, ...emailIds],
    "run",
  );
}

export const localDb = {
  async ensureReady(): Promise<void> {
    await dbClient.init();
  },

  async getEmails(params: {
    userId: string;
    view?: ViewFilter;
    mailboxId?: number;
    limit?: number;
    offset?: number;
    cursor?: { date: number; id?: number };
    search?: string;
    isRead?: "true" | "false";
    starred?: boolean;
    hasAttachment?: boolean;
    splitRule?: SplitRule | null;
  }) {
    const {
      userId,
      view = "inbox",
      mailboxId,
      limit = 100,
      offset = 0,
      cursor,
      search,
      isRead,
      starred,
      hasAttachment,
      splitRule,
    } = params;
    const now = Date.now();
    const fragments: SqlFragment[] = [{ sql: "user_id = ?", params: [userId] }];

    if (mailboxId != null) fragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });
    if (isRead === "true") fragments.push({ sql: "is_read = 1", params: [] });
    else if (isRead === "false") fragments.push({ sql: "is_read = 0", params: [] });
    if (starred) fragments.push({ sql: "has_starred = 1", params: [] });
    if (hasAttachment)
      fragments.push({
        sql: "EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = ?)",
        params: [HAS_ATTACHMENT_LABEL],
      });

    if (search) {
      const pattern = `%${search}%`;
      fragments.push({
        sql: "(subject LIKE ? OR from_name LIKE ? OR from_addr LIKE ? OR snippet LIKE ?)",
        params: [pattern, pattern, pattern, pattern],
      });
    }

    fragments.push(...buildViewConditions(view, now));
    if (view === "inbox" || view === "important") {
      fragments.push({ sql: "is_gatekept = 0", params: [] });
    }

    if (splitRule) fragments.push(...buildSplitRuleConditions(splitRule));

    if (cursor != null) {
      if (typeof cursor.id === "number" && Number.isFinite(cursor.id)) {
        fragments.push({
          sql: "(date < ? OR (date = ? AND id < ?))",
          params: [cursor.date, cursor.date, cursor.id],
        });
      } else {
        fragments.push({ sql: "date < ?", params: [cursor.date] });
      }
    }

    const { where, params: whereParams } = composeWhere(fragments);
    const effectiveOffset = cursor != null ? 0 : offset;

    const sql = `SELECT ${EMAIL_SUMMARY_SELECT} FROM emails ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`;
    const allParams = [...whereParams, limit + 1, effectiveOffset];
    const res = await dbClient.exec(sql, allParams, "rows");

    const all = rowsToObjects<EmailRowDb>(res);
    const hasMore = all.length > limit;
    const rows = hasMore ? all.slice(0, limit) : all;
    const lastRow = rows[rows.length - 1];

    return {
      data: rows.map(toEmailListItem),
      pagination: {
        limit,
        offset,
        hasMore,
        cursor: lastRow ? { date: lastRow.date, id: lastRow.id } : undefined,
      },
    };
  },

  async getViewMeta(params: {
    userId: string;
    mailboxId: number;
    view: string;
  }): Promise<{ count: number; oldestDateMs: number | null }> {
    const { userId, mailboxId, view } = params;
    const fragments: SqlFragment[] = [
      { sql: "user_id = ?", params: [userId] },
      { sql: "mailbox_id = ?", params: [mailboxId] },
    ];
    fragments.push(...buildViewConditions(view as ViewFilter, Date.now()));
    const { where, params: whereParams } = composeWhere(fragments);
    const res = await dbClient.exec(
      `SELECT COUNT(*) AS count, MIN(date) AS oldest FROM emails ${where}`,
      whereParams,
      "get",
    );
    const row = firstRow<{ count: number; oldest: number | null }>(res);
    return {
      count: row?.count ?? 0,
      oldestDateMs: row?.oldest ?? null,
    };
  },

  async getGatekeeperPending(params: {
    userId: string;
    mailboxId: number;
    limit?: number;
  }) {
    const { userId, mailboxId, limit = 30 } = params;
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT}
       FROM emails
       WHERE user_id = ? AND mailbox_id = ? AND has_inbox = 1 AND is_gatekept = 1
       ORDER BY date DESC
       LIMIT ?`,
      [userId, mailboxId, limit],
      "rows",
    );
    return rowsToObjects<EmailRowDb>(res).map(toEmailListItem);
  },

  async getGatekeeperPendingCount(userId: string, mailboxId: number): Promise<number> {
    const res = await dbClient.exec(
      `SELECT count(*) AS count
       FROM emails
       WHERE user_id = ? AND mailbox_id = ? AND has_inbox = 1 AND is_gatekept = 1`,
      [userId, mailboxId],
      "get",
    );
    const row = firstRow<{ count: number }>(res);
    return Number(row?.count ?? 0);
  },

  async applyGatekeeperDecision(params: {
    userId: string;
    mailboxId: number;
    fromAddr: string;
    decision: "accept" | "reject";
  }): Promise<void> {
    const { userId, mailboxId, fromAddr, decision } = params;
    const normalized = normalizeSender(fromAddr);
    if (!normalized) return;

    const res = await dbClient.exec(
      `SELECT id, from_addr, label_ids
       FROM emails
       WHERE user_id = ? AND mailbox_id = ? AND is_gatekept = 1`,
      [userId, mailboxId],
      "rows",
    );
    const rows = rowsToObjects<{
      id: number;
      fromAddr: string | null;
      labelIds: string | null;
    }>(res).filter((row) => normalizeSender(row.fromAddr) === normalized);
    if (rows.length === 0) return;

    for (const row of rows) {
      if (decision === "accept") {
        await dbClient.exec(
          `UPDATE emails SET is_gatekept = 0 WHERE id = ?`,
          [row.id],
          "run",
        );
        continue;
      }

      const nextLabelIds = parseLabelIds(row.labelIds).filter(
        (labelId) => labelId !== STANDARD_LABELS.INBOX && labelId !== STANDARD_LABELS.UNREAD,
      );
      if (!nextLabelIds.includes(STANDARD_LABELS.TRASH)) {
        nextLabelIds.push(STANDARD_LABELS.TRASH);
      }
      const bools = labelBooleans(nextLabelIds);

      await dbClient.exec(
        `UPDATE emails
         SET is_gatekept = 0, label_ids = ?, has_inbox = ?, has_sent = ?, has_trash = ?, has_spam = ?, has_starred = ?
         WHERE id = ?`,
        [
          JSON.stringify(nextLabelIds),
          bools.hasInbox ? 1 : 0,
          bools.hasSent ? 1 : 0,
          bools.hasTrash ? 1 : 0,
          bools.hasSpam ? 1 : 0,
          bools.hasStarred ? 1 : 0,
          row.id,
        ],
        "run",
      );
    }
  },

  async reconcileGatekeeperKnownSenders(params: {
    userId: string;
    mailboxId: number;
    gatekeeperActivatedAt: number;
  }): Promise<void> {
    const { userId, mailboxId, gatekeeperActivatedAt } = params;
    await dbClient.exec(
      `UPDATE emails AS pending
       SET is_gatekept = 0
       WHERE pending.user_id = ?
         AND pending.mailbox_id = ?
         AND pending.is_gatekept = 1
         AND EXISTS (
           SELECT 1
           FROM emails AS known
           WHERE known.user_id = pending.user_id
             AND known.mailbox_id = pending.mailbox_id
             AND known.direction = ?
             AND (known.is_gatekept = 0 OR known.date < ?)
             AND LOWER(known.from_addr) = LOWER(pending.from_addr)
         )`,
      [userId, mailboxId, "received", gatekeeperActivatedAt],
      "run",
    );
  },

  async getEmailDetail(userId: string, emailId: number) {
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT}, body_text, body_html, inline_attachments, attachments FROM emails WHERE user_id = ? AND id = ? LIMIT 1`,
      [userId, emailId],
      "get",
    );
    const row = firstRow<EmailRowDb>(res);
    if (!row) return null;
    const inlineAttachments = parseInlineAttachments(row.inlineAttachments);
    const attachments = toEmailAttachments(
      row.attachments,
      row.providerMessageId,
      row.mailboxId ?? null,
    );
    return {
      ...toEmailListItem(row),
      bodyText: row.bodyText ?? null,
      bodyHtml: row.bodyHtml ?? null,
      resolvedBodyText: row.bodyText ?? null,
      resolvedBodyHtml: row.bodyHtml ?? null,
      attachments,
      inlineAttachments,
    };
  },

  async getEmailThread(userId: string, threadId: string) {
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT}, body_text, body_html, inline_attachments, attachments FROM emails WHERE user_id = ? AND thread_id = ? ORDER BY date ASC`,
      [userId, threadId],
      "rows",
    );
    const rows = rowsToObjects<EmailRowDb>(res);
    return rows.map((row) => ({
      ...toEmailListItem(row),
      bodyText: row.bodyText ?? null,
      bodyHtml: row.bodyHtml ?? null,
      inlineAttachments: parseInlineAttachments(row.inlineAttachments),
      attachments: toEmailAttachments(
        row.attachments,
        row.providerMessageId,
        row.mailboxId ?? null,
      ),
    }));
  },

  async getDrafts(userId: string, mailboxId?: number) {
    const fragments: SqlFragment[] = [{ sql: "user_id = ?", params: [userId] }];
    if (mailboxId != null) fragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });
    const { where, params } = composeWhere(fragments);
    const res = await dbClient.exec(
      `SELECT id, compose_key, mailbox_id, to_addr, cc_addr, bcc_addr, subject, body, forwarded_content, thread_id, attachment_keys, updated_at, created_at FROM drafts ${where} ORDER BY updated_at DESC`,
      params,
      "rows",
    );
    const rows = rowsToObjects<Omit<DraftRow, "userId">>(res);
    return rows.map((r) => ({
      ...r,
      attachmentKeys: r.attachmentKeys ? (JSON.parse(r.attachmentKeys) as DraftAttachmentKey[]) : null,
    }));
  },

  async getDraftByKey(userId: string, composeKey: string) {
    const res = await dbClient.exec(
      `SELECT id, compose_key, mailbox_id, to_addr, cc_addr, bcc_addr, subject, body, forwarded_content, thread_id, attachment_keys, updated_at, created_at FROM drafts WHERE user_id = ? AND compose_key = ? LIMIT 1`,
      [userId, composeKey],
      "get",
    );
    const row = firstRow<Omit<DraftRow, "userId">>(res);
    if (!row) return null;
    return {
      ...row,
      attachmentKeys: row.attachmentKeys ? (JSON.parse(row.attachmentKeys) as DraftAttachmentKey[]) : null,
    };
  },

  async upsertDraft(params: {
    userId: string;
    composeKey: string;
    mailboxId?: number | null;
    toAddr: string;
    ccAddr: string;
    bccAddr: string;
    subject: string;
    body: string;
    forwardedContent: string;
    threadId?: string | null;
    attachmentKeys?: DraftAttachmentKey[] | null;
  }) {
    const now = Date.now();
    const attachmentKeysJson = params.attachmentKeys ? JSON.stringify(params.attachmentKeys) : null;
    await dbClient.exec(
      `INSERT INTO drafts (user_id, compose_key, mailbox_id, to_addr, cc_addr, bcc_addr, subject, body, forwarded_content, thread_id, attachment_keys, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, compose_key) DO UPDATE SET
         mailbox_id = excluded.mailbox_id,
         to_addr = excluded.to_addr,
         cc_addr = excluded.cc_addr,
         bcc_addr = excluded.bcc_addr,
         subject = excluded.subject,
         body = excluded.body,
         forwarded_content = excluded.forwarded_content,
         thread_id = excluded.thread_id,
         attachment_keys = excluded.attachment_keys,
         updated_at = excluded.updated_at`,
      [
        params.userId,
        params.composeKey,
        params.mailboxId ?? null,
        params.toAddr,
        params.ccAddr,
        params.bccAddr,
        params.subject,
        params.body,
        params.forwardedContent,
        params.threadId ?? null,
        attachmentKeysJson,
        now,
        now,
      ],
      "run",
    );

    const saved = await localDb.getDraftByKey(params.userId, params.composeKey);
    if (!saved) throw new Error("Draft upsert failed");
    return saved;
  },

  async deleteDraft(id: number, userId: string): Promise<void> {
    await dbClient.exec(
      `DELETE FROM drafts WHERE id = ? AND user_id = ?`,
      [id, userId],
      "run",
    );
  },

  async updateEmail(userId: string, emailId: number, patch: LocalEmailPatch): Promise<void> {
    const res = await dbClient.exec(
      `SELECT is_read, label_ids, snoozed_until FROM emails WHERE user_id = ? AND id = ? LIMIT 1`,
      [userId, emailId],
      "get",
    );
    const row = firstRow<{ isRead: number; labelIds: string | null; snoozedUntil: number | null }>(res);
    if (!row) return;
    const updates = applyEmailPatch(
      { isRead: toBool(row.isRead), labelIds: row.labelIds, snoozedUntil: row.snoozedUntil },
      patch,
    );
    await updateEmailByIds(userId, [emailId], updates);
  },

  async updateEmails(userId: string, emailIds: number[], patch: LocalEmailPatch): Promise<void> {
    if (emailIds.length === 0) return;
    const placeholders = emailIds.map(() => "?").join(", ");
    const res = await dbClient.exec(
      `SELECT id, is_read, label_ids, snoozed_until FROM emails WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...emailIds],
      "rows",
    );
    const rows = rowsToObjects<{ id: number; isRead: number; labelIds: string | null; snoozedUntil: number | null }>(res);
    if (rows.length === 0) return;

    for (const current of rows) {
      const updates = applyEmailPatch(
        { isRead: toBool(current.isRead), labelIds: current.labelIds, snoozedUntil: current.snoozedUntil },
        patch,
      );
      await updateEmailByIds(userId, [current.id], updates);
    }
  },

  async insertEmails(rows: EmailInsert[]): Promise<void> {
    if (!rows.length) return;
    const CHUNK = 50;
    const INSERT_COLUMNS = `
      id, user_id, mailbox_id, provider_message_id, thread_id, from_addr, from_name,
      to_addr, cc_addr, subject, snippet, body_text, body_html, date, direction,
      is_read, label_ids, has_inbox, has_sent, has_trash, has_spam, has_starred,
      unsubscribe_url, unsubscribe_email, snoozed_until, inline_attachments, attachments, has_calendar, is_gatekept, created_at`;
    const TUPLE = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    // Fields that ARE safe to overwrite (immutable from the user's point of view).
    const CONFLICT_SAFE = `
      from_addr = excluded.from_addr,
      from_name = excluded.from_name,
      to_addr = excluded.to_addr,
      cc_addr = excluded.cc_addr,
      subject = excluded.subject,
      snippet = excluded.snippet,
      body_text = excluded.body_text,
      body_html = excluded.body_html,
      inline_attachments = excluded.inline_attachments,
      attachments = excluded.attachments,
      has_calendar = excluded.has_calendar,
      is_gatekept = excluded.is_gatekept`;
    // Fields we overwrite only when the row has no pending local mutation.
    const CONFLICT_MUTABLE = `
      is_read = excluded.is_read,
      label_ids = excluded.label_ids,
      has_inbox = excluded.has_inbox,
      has_sent = excluded.has_sent,
      has_trash = excluded.has_trash,
      has_spam = excluded.has_spam,
      has_starred = excluded.has_starred,
      snoozed_until = excluded.snoozed_until`;

    function rowParams(row: EmailInsert): BindParam[] {
      const ids = normalizeLabelIds(row.labelIds as unknown as string | string[] | null);
      const bools = labelBooleans(ids);
      return [
        row.id ?? null,
        row.userId,
        row.mailboxId ?? null,
        row.providerMessageId,
        row.threadId ?? null,
        row.fromAddr,
        row.fromName ?? null,
        row.toAddr ?? null,
        row.ccAddr ?? null,
        row.subject ?? null,
        row.snippet ?? null,
        row.bodyText ?? null,
        row.bodyHtml ?? null,
        row.date,
        row.direction ?? null,
        boolParam(row.isRead ?? false),
        JSON.stringify(ids),
        boolParam(bools.hasInbox),
        boolParam(bools.hasSent),
        boolParam(bools.hasTrash),
        boolParam(bools.hasSpam),
        boolParam(bools.hasStarred),
        row.unsubscribeUrl ?? null,
        row.unsubscribeEmail ?? null,
        row.snoozedUntil ?? null,
        row.inlineAttachments ?? null,
        row.attachments ?? null,
        boolParam(row.hasCalendar ?? false),
        boolParam(row.isGatekept ?? false),
        row.createdAt,
      ];
    }

    async function insertBatch(batch: EmailInsert[], includeMutable: boolean) {
      if (batch.length === 0) return;
      const values: string[] = [];
      const params: BindParam[] = [];
      for (const row of batch) {
        values.push(TUPLE);
        params.push(...rowParams(row));
      }
      const setClause = includeMutable
        ? `${CONFLICT_SAFE},\n${CONFLICT_MUTABLE}`
        : CONFLICT_SAFE;
      await dbClient.exec(
        `INSERT INTO emails (${INSERT_COLUMNS}) VALUES ${values.join(", ")}
         ON CONFLICT (provider_message_id) DO UPDATE SET ${setClause}`,
        params,
        "run",
      );
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const locked = pendingSubset(chunk.map((r) => r.providerMessageId));

      if (locked.size === 0) {
        await insertBatch(chunk, true);
        continue;
      }

      const free: EmailInsert[] = [];
      const pending: EmailInsert[] = [];
      for (const row of chunk) {
        if (locked.has(row.providerMessageId)) pending.push(row);
        else free.push(row);
      }
      await insertBatch(free, true);
      await insertBatch(pending, false);
    }
  },

  async searchEmails(params: {
    userId: string;
    query: string;
    mailboxId?: number;
    view?: ViewFilter;
    limit?: number;
    offset?: number;
    includeJunk?: boolean;
  }) {
    const { userId, query, mailboxId, view, limit = 30, offset = 0, includeJunk = false } = params;
    const pattern = `%${query}%`;

    const baseFragments: SqlFragment[] = [
      { sql: "user_id = ?", params: [userId] },
      {
        sql: "(subject LIKE ? OR from_name LIKE ? OR from_addr LIKE ? OR snippet LIKE ?)",
        params: [pattern, pattern, pattern, pattern],
      },
    ];
    if (mailboxId != null) baseFragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });

    const fragments = [...baseFragments];
    if (view) {
      fragments.push(...buildViewConditions(view, Date.now()));
    } else if (!includeJunk) {
      fragments.push({ sql: "has_spam = 0", params: [] });
      fragments.push({ sql: "has_trash = 0", params: [] });
    }

    const { where, params: whereParams } = composeWhere(fragments);
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT} FROM emails ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [...whereParams, limit + 1, offset],
      "rows",
    );
    const all = rowsToObjects<EmailRowDb>(res);
    const hasMore = all.length > limit;
    const rows = hasMore ? all.slice(0, limit) : all;

    let hiddenJunkCount = 0;
    if (!includeJunk && !view) {
      const { where: baseWhere, params: baseParams } = composeWhere([
        ...baseFragments,
        { sql: "(has_spam = 1 OR has_trash = 1)", params: [] },
      ]);
      const countRes = await dbClient.exec(
        `SELECT count(*) AS count FROM emails ${baseWhere}`,
        baseParams,
        "get",
      );
      hiddenJunkCount = Number(firstRow<{ count: number }>(countRes)?.count ?? 0);
    }

    return {
      data: rows.map(toEmailListItem),
      pagination: { limit, offset, hasMore },
      searchMeta: { hiddenJunkCount },
    };
  },

  async getContactSuggestions(
    userId: string,
    query: string,
    mailboxId?: number,
    limit?: number,
  ) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const maxResults = limit ?? 8;
    const mailboxFilter = mailboxId ?? null;
    const containsPattern = `%${normalizedQuery}%`;
    const startsWithPattern = `${normalizedQuery}%`;

    const res = await dbClient.exec(
      `WITH contact_sources AS (
         SELECT LOWER(from_addr) AS email, MAX(from_name) AS name, MAX(date) AS last_date, COUNT(*) AS interaction_count
         FROM emails
         WHERE user_id = ?
           AND (? IS NULL OR mailbox_id = ?)
           AND direction = 'received'
           AND from_addr IS NOT NULL
           AND TRIM(from_addr) <> ''
         GROUP BY LOWER(from_addr)

         UNION ALL

         SELECT LOWER(to_addr) AS email, NULL AS name, MAX(date) AS last_date, COUNT(*) AS interaction_count
         FROM emails
         WHERE user_id = ?
           AND (? IS NULL OR mailbox_id = ?)
           AND direction = 'sent'
           AND to_addr IS NOT NULL
           AND TRIM(to_addr) <> ''
         GROUP BY LOWER(to_addr)

         UNION ALL

         SELECT LOWER(cc_addr) AS email, NULL AS name, MAX(date) AS last_date, COUNT(*) AS interaction_count
         FROM emails
         WHERE user_id = ?
           AND (? IS NULL OR mailbox_id = ?)
           AND direction = 'sent'
           AND cc_addr IS NOT NULL
           AND TRIM(cc_addr) <> ''
         GROUP BY LOWER(cc_addr)
       ),
       aggregated AS (
         SELECT
           email,
           MAX(name) AS name,
           MAX(last_date) AS last_date,
           SUM(interaction_count) AS count
         FROM contact_sources
         WHERE email IS NOT NULL
         GROUP BY email
       )
       SELECT email, name, last_date, count
       FROM aggregated
       WHERE INSTR(email, '@') > 1
         AND (email LIKE ? OR COALESCE(LOWER(name), '') LIKE ?)
       ORDER BY
         CASE
           WHEN email = ? THEN 0
           WHEN email LIKE ? THEN 1
           WHEN COALESCE(LOWER(name), '') LIKE ? THEN 2
           ELSE 3
         END,
         count DESC,
         last_date DESC
       LIMIT ?`,
      [
        userId,
        mailboxFilter,
        mailboxFilter,
        userId,
        mailboxFilter,
        mailboxFilter,
        userId,
        mailboxFilter,
        mailboxFilter,
        containsPattern,
        containsPattern,
        normalizedQuery,
        startsWithPattern,
        startsWithPattern,
        maxResults * 3,
      ],
      "rows",
    );

    const rows = rowsToObjects<{
      email: string | null;
      name: string | null;
      lastDate: number | null;
      count: number;
    }>(res);

    const suggestions: Array<{
      email: string;
      name: string | null;
      avatarUrl: string | null;
      lastInteractionAt: number | null;
      interactionCount: number;
    }> = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const normalizedEmail = normalizeSender(row.email);
      if (!normalizedEmail) continue;
      if (seen.has(normalizedEmail)) continue;
      seen.add(normalizedEmail);

      suggestions.push({
        email: normalizedEmail,
        name: row.name,
        avatarUrl: null,
        lastInteractionAt: row.lastDate ?? null,
        interactionCount: Number(row.count ?? 0),
      });

      if (suggestions.length >= maxResults) {
        break;
      }
    }

    return suggestions;
  },

  async getSearchSuggestions(params: {
    userId: string;
    query: string;
    mailboxId?: number;
    view?: ViewFilter;
  }) {
    const { userId, query, mailboxId, view } = params;
    const normalized = query.trim();

    const contacts = normalized
      ? await localDb.getContactSuggestions(userId, normalized, mailboxId, 6)
      : [];

    const fragments: SqlFragment[] = [{ sql: "user_id = ?", params: [userId] }];
    if (mailboxId != null) fragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });
    if (view) fragments.push(...buildViewConditions(view, Date.now()));

    fragments.push({ sql: "coalesce(subject, '') <> ''", params: [] });
    fragments.push({ sql: "subject LIKE ?", params: [`%${normalized}%`] });

    const { where, params: whereParams } = composeWhere(fragments);

    const subjectRows = normalized
      ? rowsToObjects<{ subject: string | null; lastUsedAt: number | null }>(
          await dbClient.exec(
            `SELECT subject, max(date) AS last_used_at FROM emails ${where} GROUP BY subject ORDER BY max(date) DESC LIMIT 8`,
            whereParams,
            "rows",
          ),
        )
      : [];

    return {
      filters: [] as [],
      contacts: contacts.map((contact) => ({
        kind: "contact" as const,
        id: `contact:${contact.email}`,
        label: contact.name ?? contact.email,
        query: `from:${contact.email}`,
        description: contact.email,
        ...contact,
      })),
      subjects: subjectRows
        .filter((row): row is { subject: string; lastUsedAt: number | null } => row.subject !== null)
        .map((row) => ({
          kind: "subject" as const,
          id: `subject:${row.subject}`,
          label: row.subject,
          query: `subject:"${row.subject}"`,
          subject: row.subject,
          description: null as string | null,
          lastUsedAt: row.lastUsedAt ?? null,
        })),
    };
  },

  async getLabels(userId: string, mailboxId: number) {
    const res = await dbClient.exec(
      `SELECT gmail_id, name, type, text_color, background_color, messages_total, messages_unread FROM labels WHERE user_id = ? AND mailbox_id = ? ORDER BY name ASC`,
      [userId, mailboxId],
      "rows",
    );
    return rowsToObjects<{
      gmailId: string;
      name: string;
      type: "system" | "user";
      textColor: string | null;
      backgroundColor: string | null;
      messagesTotal: number;
      messagesUnread: number;
    }>(res);
  },

  async upsertLabels(
    userId: string,
    mailboxId: number,
    labels: Array<{
      gmailId: string;
      name: string;
      type?: "system" | "user";
      textColor?: string | null;
      backgroundColor?: string | null;
      messagesTotal?: number;
      messagesUnread?: number;
    }>,
  ): Promise<void> {
    if (labels.length === 0) return;
    const now = Date.now();
    const CHUNK = 50;
    const TUPLE = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    for (let i = 0; i < labels.length; i += CHUNK) {
      const batch = labels.slice(i, i + CHUNK);
      const values: string[] = [];
      const params: BindParam[] = [];

      for (const label of batch) {
        values.push(TUPLE);
        const row: LabelInsert = {
          gmailId: label.gmailId,
          userId,
          mailboxId,
          name: label.name,
          type: label.type ?? "user",
          textColor: label.textColor ?? null,
          backgroundColor: label.backgroundColor ?? null,
          messagesTotal: label.messagesTotal ?? 0,
          messagesUnread: label.messagesUnread ?? 0,
          syncedAt: now,
        };
        params.push(
          row.gmailId,
          row.userId,
          row.mailboxId,
          row.name,
          row.type,
          row.textColor,
          row.backgroundColor,
          row.messagesTotal,
          row.messagesUnread,
          row.syncedAt,
        );
      }

      await dbClient.exec(
        `INSERT INTO labels (gmail_id, user_id, mailbox_id, name, type, text_color, background_color, messages_total, messages_unread, synced_at)
         VALUES ${values.join(", ")}
         ON CONFLICT (gmail_id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           text_color = excluded.text_color,
           background_color = excluded.background_color,
           messages_total = excluded.messages_total,
           messages_unread = excluded.messages_unread,
           synced_at = excluded.synced_at`,
        params,
        "run",
      );
    }
  },

  async deleteLabel(gmailId: string): Promise<void> {
    await dbClient.exec(`DELETE FROM labels WHERE gmail_id = ?`, [gmailId], "run");
  },

  async setMeta(key: string, value: string): Promise<void> {
    await dbClient.exec(
      `INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?`,
      [key, value, value],
      "run",
    );
  },

  async getMeta(key: string): Promise<string | null> {
    const res = await dbClient.exec(
      `SELECT value FROM _meta WHERE key = ? LIMIT 1`,
      [key],
      "get",
    );
    const row = firstRow<{ value: string }>(res);
    return row?.value ?? null;
  },

  async clear(): Promise<void> {
    await dbClient.batch([
      { sql: "DELETE FROM labels" },
      { sql: "DELETE FROM drafts" },
      { sql: "DELETE FROM emails" },
      { sql: "DELETE FROM _meta" },
    ]);
  },

  async getEmailsByProviderMessageIds(
    userId: string,
    providerMessageIds: string[],
  ) {
    if (providerMessageIds.length === 0) return [];
    const CHUNK = 100;
    const all: EmailRowDb[] = [];
    for (let i = 0; i < providerMessageIds.length; i += CHUNK) {
      const chunk = providerMessageIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(", ");
      const res = await dbClient.exec(
        `SELECT ${EMAIL_SUMMARY_SELECT} FROM emails WHERE user_id = ? AND provider_message_id IN (${placeholders})`,
        [userId, ...chunk],
        "rows",
      );
      all.push(...rowsToObjects<EmailRowDb>(res));
    }
    return all.map(toEmailListItem);
  },

  async getKnownSenders(params: {
    userId: string;
    mailboxId: number;
    gatekeeperActivatedAt: number;
    senders: string[];
  }): Promise<string[]> {
    const { userId, mailboxId, gatekeeperActivatedAt, senders } = params;
    const normalized = Array.from(
      new Set(
        senders.map((sender) => sender.trim().toLowerCase()).filter(Boolean),
      ),
    );
    if (normalized.length === 0) return [];

    const CHUNK = 80;
    const known = new Set<string>();

    for (let i = 0; i < normalized.length; i += CHUNK) {
      const chunk = normalized.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(", ");
      const res = await dbClient.exec(
        `SELECT DISTINCT LOWER(from_addr) AS from_addr
         FROM emails
         WHERE user_id = ? AND mailbox_id = ? AND direction = ?
           AND (is_gatekept = 0 OR date < ?)
           AND LOWER(from_addr) IN (${placeholders})`,
        [userId, mailboxId, "received", gatekeeperActivatedAt, ...chunk],
        "rows",
      );

      const rows = rowsToObjects<{ fromAddr: string }>(res);
      for (const row of rows) {
        if (row.fromAddr) known.add(row.fromAddr);
      }
    }

    return Array.from(known);
  },

  async isThreadClassificationFresh(params: {
    userId: string;
    mailboxId: number;
    threadId: string | null;
    representativeProviderMessageId: string;
    classificationKey: string;
  }): Promise<boolean> {
    const {
      userId,
      mailboxId,
      threadId,
      representativeProviderMessageId,
      classificationKey,
    } = params;

    const query = threadId
      ? {
          sql: `SELECT ai_classification_key, ai_category FROM emails
                WHERE user_id = ? AND mailbox_id = ? AND thread_id = ?
                ORDER BY date DESC LIMIT 1`,
          params: [userId, mailboxId, threadId] as BindParam[],
        }
      : {
          sql: `SELECT ai_classification_key, ai_category FROM emails
                WHERE user_id = ? AND mailbox_id = ? AND provider_message_id = ?
                LIMIT 1`,
          params: [userId, mailboxId, representativeProviderMessageId] as BindParam[],
        };

    const res = await dbClient.exec(query.sql, query.params, "get");
    const row = firstRow<{
      aiClassificationKey: string | null;
      aiCategory: EmailAICategory | null;
    }>(res);
    return Boolean(
      row &&
      row.aiClassificationKey === classificationKey &&
      row.aiCategory !== null,
    );
  },

  async updateThreadClassification(params: {
    userId: string;
    mailboxId: number;
    threadId: string | null;
    representativeProviderMessageId: string;
    classificationKey: string;
    category: EmailAICategory;
    confidence: number;
    reason: string;
    summary: string;
    draftReply: string;
    classifiedAt: number;
  }): Promise<void> {
    const {
      userId,
      mailboxId,
      threadId,
      representativeProviderMessageId,
      classificationKey,
      category,
      confidence,
      reason,
      summary,
      draftReply,
      classifiedAt,
    } = params;

    if (threadId) {
      await dbClient.exec(
        `UPDATE emails
         SET ai_category = ?, ai_confidence = ?, ai_reason = ?, ai_summary = ?,
             ai_draft_reply = ?, ai_classified_at = ?, ai_classification_key = ?
         WHERE user_id = ? AND mailbox_id = ? AND thread_id = ?`,
        [
          category,
          confidence,
          reason,
          summary,
          draftReply,
          classifiedAt,
          classificationKey,
          userId,
          mailboxId,
          threadId,
        ],
        "run",
      );
      return;
    }

    await dbClient.exec(
      `UPDATE emails
       SET ai_category = ?, ai_confidence = ?, ai_reason = ?, ai_summary = ?,
           ai_draft_reply = ?, ai_classified_at = ?, ai_classification_key = ?
       WHERE user_id = ? AND mailbox_id = ? AND provider_message_id = ?`,
      [
        category,
        confidence,
        reason,
        summary,
        draftReply,
        classifiedAt,
        classificationKey,
        userId,
        mailboxId,
        representativeProviderMessageId,
      ],
      "run",
    );
  },

  async deleteEmailsByProviderMessageId(providerMessageIds: string[]): Promise<void> {
    if (!providerMessageIds.length) return;
    const CHUNK = 50;
    for (let i = 0; i < providerMessageIds.length; i += CHUNK) {
      const chunk = providerMessageIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => "?").join(", ");
      await dbClient.exec(
        `DELETE FROM emails WHERE provider_message_id IN (${placeholders})`,
        chunk,
        "run",
      );
    }
  },

  async addLabelToEmails(providerMessageIds: string[], labelId: string): Promise<void> {
    if (!providerMessageIds.length) return;
    const placeholders = providerMessageIds.map(() => "?").join(", ");
    const res = await dbClient.exec(
      `SELECT id, label_ids FROM emails WHERE provider_message_id IN (${placeholders})`,
      providerMessageIds,
      "rows",
    );
    const rows = rowsToObjects<{ id: number; labelIds: string | null }>(res);
    for (const row of rows) {
      const ids = parseLabelIds(row.labelIds);
      if (ids.includes(labelId)) continue;
      const next = [...ids, labelId];
      const bools = labelBooleans(next);
      await dbClient.exec(
        `UPDATE emails SET label_ids = ?, has_inbox = ?, has_sent = ?, has_trash = ?, has_spam = ?, has_starred = ? WHERE id = ?`,
        [JSON.stringify(next), bools.hasInbox ? 1 : 0, bools.hasSent ? 1 : 0, bools.hasTrash ? 1 : 0, bools.hasSpam ? 1 : 0, bools.hasStarred ? 1 : 0, row.id],
        "run",
      );
    }
  },

  async removeLabelFromEmails(providerMessageIds: string[], labelId: string): Promise<void> {
    if (!providerMessageIds.length) return;
    const placeholders = providerMessageIds.map(() => "?").join(", ");
    const res = await dbClient.exec(
      `SELECT id, label_ids FROM emails WHERE provider_message_id IN (${placeholders})`,
      providerMessageIds,
      "rows",
    );
    const rows = rowsToObjects<{ id: number; labelIds: string | null }>(res);
    for (const row of rows) {
      const ids = parseLabelIds(row.labelIds);
      if (!ids.includes(labelId)) continue;
      const next = ids.filter((id) => id !== labelId);
      const bools = labelBooleans(next);
      await dbClient.exec(
        `UPDATE emails SET label_ids = ?, has_inbox = ?, has_sent = ?, has_trash = ?, has_spam = ?, has_starred = ? WHERE id = ?`,
        [JSON.stringify(next), bools.hasInbox ? 1 : 0, bools.hasSent ? 1 : 0, bools.hasTrash ? 1 : 0, bools.hasSpam ? 1 : 0, bools.hasStarred ? 1 : 0, row.id],
        "run",
      );
    }
  },

  async listSplitViews(userId: string): Promise<SplitViewRow[]> {
    const res = await dbClient.exec(
      `SELECT id, user_id AS userId, name, description, icon, color,
              position, visible, pinned, is_system AS isSystem,
              system_key AS systemKey, rules,
              match_mode AS matchMode, show_in_other AS showInOther,
              created_at AS createdAt, updated_at AS updatedAt
       FROM split_views
       WHERE user_id = ?
       ORDER BY position ASC, created_at ASC`,
      [userId],
      "rows",
    );
    type Raw = Omit<SplitViewRow, "rules" | "visible" | "pinned" | "isSystem" | "showInOther"> & {
      rules: string | null;
      visible: number;
      pinned: number;
      isSystem: number;
      showInOther: number;
    };
    const rows = rowsToObjects<Raw>(res);
    return rows.map((row) => ({
      ...row,
      visible: Boolean(row.visible),
      pinned: Boolean(row.pinned),
      isSystem: Boolean(row.isSystem),
      showInOther: Boolean(row.showInOther),
      rules: row.rules ? (safeJsonParse<SplitRule>(row.rules) ?? null) : null,
    }));
  },

  async upsertSplitView(view: SplitViewRow): Promise<void> {
    await dbClient.exec(
      `INSERT INTO split_views (
         id, user_id, name, description, icon, color, position, visible, pinned,
         is_system, system_key, rules, match_mode, show_in_other,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         icon = excluded.icon,
         color = excluded.color,
         position = excluded.position,
         visible = excluded.visible,
         pinned = excluded.pinned,
         is_system = excluded.is_system,
         system_key = excluded.system_key,
         rules = excluded.rules,
         match_mode = excluded.match_mode,
         show_in_other = excluded.show_in_other,
         updated_at = excluded.updated_at`,
      [
        view.id,
        view.userId,
        view.name,
        view.description,
        view.icon,
        view.color,
        view.position,
        view.visible ? 1 : 0,
        view.pinned ? 1 : 0,
        view.isSystem ? 1 : 0,
        view.systemKey,
        view.rules ? JSON.stringify(view.rules) : null,
        view.matchMode,
        view.showInOther ? 1 : 0,
        view.createdAt,
        view.updatedAt,
      ],
      "run",
    );
  },

  async replaceSplitViews(userId: string, views: SplitViewRow[]): Promise<void> {
    await dbClient.exec(`DELETE FROM split_views WHERE user_id = ?`, [userId], "run");
    for (const view of views) {
      await this.upsertSplitView(view);
    }
  },

  async deleteSplitView(id: string, userId: string): Promise<void> {
    await dbClient.exec(
      `DELETE FROM split_views WHERE id = ? AND user_id = ? AND is_system = 0`,
      [id, userId],
      "run",
    );
  },

  async setSplitViewVisible(
    id: string,
    userId: string,
    visible: boolean,
  ): Promise<void> {
    await dbClient.exec(
      `UPDATE split_views SET visible = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [visible ? 1 : 0, Date.now(), id, userId],
      "run",
    );
  },

  async emailCount(userId: string, mailboxId?: number): Promise<number> {
    const fragments: SqlFragment[] = [{ sql: "user_id = ?", params: [userId] }];
    if (mailboxId != null) fragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });
    const { where, params } = composeWhere(fragments);
    const res = await dbClient.exec(
      `SELECT count(*) AS count FROM emails ${where}`,
      params,
      "get",
    );
    const row = firstRow<{ count: number }>(res);
    return Number(row?.count ?? 0);
  },

  async deleteDatabase(): Promise<void> {
    await dbClient.deleteDb();
  },
};

export async function clearLocalData(): Promise<void> {
  try {
    await localDb.ensureReady();
    await localDb.deleteDatabase();
  } catch {
    // Ignore worker shutdown/initialization races during logout.
  }
}
