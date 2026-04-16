import { dbClient, type ExecResult } from "./worker-client";
import type {
  DraftAttachmentKey,
  DraftRow,
  EmailInsert,
  LabelInsert,
} from "./schema";

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
  bodyText?: string | null;
  bodyHtml?: string | null;
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

const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

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

function parseLabelIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
        {
          sql: "EXISTS (SELECT 1 FROM json_each(label_ids) WHERE value = 'IMPORTANT')",
          params: [],
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
  snoozed_until
`;

function toEmailListItem(row: EmailRowDb) {
  const labelIds = parseLabelIds(row.labelIds);
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
    cursor?: number;
    search?: string;
    isRead?: "true" | "false";
  }) {
    const { userId, view = "inbox", mailboxId, limit = 100, offset = 0, cursor, search, isRead } = params;
    const now = Date.now();
    const fragments: SqlFragment[] = [{ sql: "user_id = ?", params: [userId] }];

    if (mailboxId != null) fragments.push({ sql: "mailbox_id = ?", params: [mailboxId] });
    if (isRead === "true") fragments.push({ sql: "is_read = 1", params: [] });
    else if (isRead === "false") fragments.push({ sql: "is_read = 0", params: [] });

    if (search) {
      const pattern = `%${search}%`;
      fragments.push({
        sql: "(subject LIKE ? OR from_name LIKE ? OR from_addr LIKE ? OR snippet LIKE ?)",
        params: [pattern, pattern, pattern, pattern],
      });
    }

    fragments.push(...buildViewConditions(view, now));

    if (cursor != null) fragments.push({ sql: "date < ?", params: [cursor] });

    const { where, params: whereParams } = composeWhere(fragments);
    const effectiveOffset = cursor != null ? 0 : offset;

    const sql = `SELECT ${EMAIL_SUMMARY_SELECT} FROM emails ${where} ORDER BY date DESC LIMIT ? OFFSET ?`;
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
        cursor: lastRow?.date,
      },
    };
  },

  async getEmailDetail(userId: string, emailId: number) {
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT}, body_text, body_html FROM emails WHERE user_id = ? AND id = ? LIMIT 1`,
      [userId, emailId],
      "get",
    );
    const row = firstRow<EmailRowDb>(res);
    if (!row) return null;
    return {
      ...toEmailListItem(row),
      bodyText: row.bodyText ?? null,
      bodyHtml: row.bodyHtml ?? null,
      resolvedBodyText: row.bodyText ?? null,
      resolvedBodyHtml: row.bodyHtml ?? null,
      attachments: [] as [],
    };
  },

  async getEmailThread(userId: string, threadId: string) {
    const res = await dbClient.exec(
      `SELECT ${EMAIL_SUMMARY_SELECT}, body_text, body_html FROM emails WHERE user_id = ? AND thread_id = ? ORDER BY date ASC`,
      [userId, threadId],
      "rows",
    );
    const rows = rowsToObjects<EmailRowDb>(res);
    return rows.map((row) => ({
      ...toEmailListItem(row),
      bodyText: row.bodyText ?? null,
      bodyHtml: row.bodyHtml ?? null,
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
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const values: string[] = [];
      const params: BindParam[] = [];
      for (const row of chunk) {
        const ids = normalizeLabelIds(row.labelIds as unknown as string | string[] | null);
        const bools = labelBooleans(ids);
        values.push(
          "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        params.push(
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
          row.createdAt,
        );
      }
      await dbClient.exec(
        `INSERT INTO emails (
          id, user_id, mailbox_id, provider_message_id, thread_id, from_addr, from_name,
          to_addr, cc_addr, subject, snippet, body_text, body_html, date, direction,
          is_read, label_ids, has_inbox, has_sent, has_trash, has_spam, has_starred,
          unsubscribe_url, unsubscribe_email, snoozed_until, created_at
        ) VALUES ${values.join(", ")}
        ON CONFLICT (provider_message_id) DO UPDATE SET
          from_addr = excluded.from_addr,
          from_name = excluded.from_name,
          to_addr = excluded.to_addr,
          cc_addr = excluded.cc_addr,
          subject = excluded.subject,
          snippet = excluded.snippet,
          body_text = excluded.body_text,
          body_html = excluded.body_html,
          is_read = excluded.is_read,
          label_ids = excluded.label_ids,
          has_inbox = excluded.has_inbox,
          has_sent = excluded.has_sent,
          has_trash = excluded.has_trash,
          has_spam = excluded.has_spam,
          has_starred = excluded.has_starred,
          snoozed_until = excluded.snoozed_until`,
        params,
        "run",
      );
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

  async getContactSuggestions(userId: string, query: string, limit?: number) {
    const pattern = `%${query}%`;
    const res = await dbClient.exec(
      `SELECT from_addr, max(from_name) AS from_name, max(date) AS last_date, count(*) AS count
       FROM emails
       WHERE user_id = ? AND (from_addr LIKE ? OR from_name LIKE ?)
       GROUP BY from_addr
       ORDER BY count(*) DESC
       LIMIT ?`,
      [userId, pattern, pattern, limit ?? 8],
      "rows",
    );
    const rows = rowsToObjects<{
      fromAddr: string;
      fromName: string | null;
      lastDate: number | null;
      count: number;
    }>(res);

    return rows.map((r) => ({
      email: r.fromAddr,
      name: r.fromName,
      avatarUrl: null as string | null,
      lastInteractionAt: r.lastDate,
      interactionCount: Number(r.count),
    }));
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
      ? await localDb.getContactSuggestions(userId, normalized, 6)
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
    const rows: LabelInsert[] = labels.map((l) => ({
      gmailId: l.gmailId,
      userId,
      mailboxId,
      name: l.name,
      type: l.type ?? "user",
      textColor: l.textColor ?? null,
      backgroundColor: l.backgroundColor ?? null,
      messagesTotal: l.messagesTotal ?? 0,
      messagesUnread: l.messagesUnread ?? 0,
      syncedAt: now,
    }));

    for (const row of rows) {
      await dbClient.exec(
        `INSERT INTO labels (gmail_id, user_id, mailbox_id, name, type, text_color, background_color, messages_total, messages_unread, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (gmail_id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           text_color = excluded.text_color,
           background_color = excluded.background_color,
           messages_total = excluded.messages_total,
           messages_unread = excluded.messages_unread,
           synced_at = excluded.synced_at`,
        [
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
        ],
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
