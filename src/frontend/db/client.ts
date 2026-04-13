import { type SQL, and, asc, desc, eq, gt, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { deleteDatabase as deleteSqliteDb, execSql, initSqliteRpc, waitForReady } from "./sqlite-rpc";
import * as schema from "./schema";

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

type EmailInsert = typeof schema.emails.$inferInsert;
type SubscriptionInsert = typeof schema.emailSubscriptions.$inferInsert;
type LabelInsert = typeof schema.labels.$inferInsert;

type EmailQueryRow = {
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
  isRead: boolean;
  labelIds: string | null;
  hasInbox: boolean;
  hasSent: boolean;
  hasTrash: boolean;
  hasSpam: boolean;
  hasStarred: boolean;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
};

const db = drizzle(async (sql_query, params, method) => {
  return execSql(sql_query, params, method);
}, { schema });

let initPromise: Promise<void> | null = null;

async function ensureDb() {
  if (!initPromise) {
    initPromise = (async () => {
      initSqliteRpc();
      await waitForReady();
    })();
  }
  await initPromise;
  return db;
}

const STANDARD_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  SPAM: "SPAM",
  TRASH: "TRASH",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
} as const;

function parseLabelIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
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

function applyEmailPatch(
  current: { isRead: boolean; labelIds: string | null; snoozedUntil: number | null },
  patch: LocalEmailPatch,
) {
  const currentLabelIds = parseLabelIds(current.labelIds);
  const nextLabelIds = new Set(currentLabelIds);
  const dbUpdates: Partial<EmailInsert> = {};

  const queueAdd = (labelId: string) => nextLabelIds.add(labelId);
  const queueRemove = (labelId: string) => nextLabelIds.delete(labelId);

  if (patch.isRead !== undefined && patch.isRead !== current.isRead) {
    dbUpdates.isRead = patch.isRead;
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
      if (!nextLabelIds.has(STANDARD_LABELS.SPAM)) {
        queueAdd(STANDARD_LABELS.INBOX);
      }
    }
  }

  if (patch.spam !== undefined) {
    if (patch.spam) {
      queueAdd(STANDARD_LABELS.SPAM);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.TRASH);
    } else {
      queueRemove(STANDARD_LABELS.SPAM);
      if (!nextLabelIds.has(STANDARD_LABELS.TRASH)) {
        queueAdd(STANDARD_LABELS.INBOX);
      }
    }
  }

  if (patch.starred !== undefined) {
    if (patch.starred) queueAdd(STANDARD_LABELS.STARRED);
    else queueRemove(STANDARD_LABELS.STARRED);
  }

  if (patch.snoozedUntil !== undefined) dbUpdates.snoozedUntil = patch.snoozedUntil;
  if (patch.bodyText !== undefined) dbUpdates.bodyText = patch.bodyText;
  if (patch.bodyHtml !== undefined) dbUpdates.bodyHtml = patch.bodyHtml;

  if (patch.labelIds !== undefined) {
    const resolved = patch.labelIds ?? [];
    dbUpdates.labelIds = JSON.stringify(resolved);
    Object.assign(dbUpdates, labelBooleans(resolved));
    return dbUpdates;
  }

  const resolvedLabelIds = Array.from(nextLabelIds);
  if (!areLabelIdsEqual(currentLabelIds, resolvedLabelIds)) {
    dbUpdates.labelIds = JSON.stringify(resolvedLabelIds);
    Object.assign(dbUpdates, labelBooleans(resolvedLabelIds));
  }

  return dbUpdates;
}

function buildViewConditions(view: ViewFilter, now: number): SQL[] {
  switch (view) {
    case "inbox": {
      const snoozeCondition = or(isNull(schema.emails.snoozedUntil), lte(schema.emails.snoozedUntil, now));
      return snoozeCondition
        ? [eq(schema.emails.hasInbox, true), snoozeCondition]
        : [eq(schema.emails.hasInbox, true)];
    }
    case "sent":
      return [eq(schema.emails.hasSent, true)];
    case "spam":
      return [eq(schema.emails.hasSpam, true)];
    case "trash":
      return [eq(schema.emails.hasTrash, true)];
    case "snoozed":
      return [gt(schema.emails.snoozedUntil, now)];
    case "archived":
      return [
        eq(schema.emails.hasInbox, false),
        eq(schema.emails.hasSent, false),
        eq(schema.emails.hasTrash, false),
        eq(schema.emails.hasSpam, false),
      ];
    case "starred":
      return [eq(schema.emails.hasStarred, true)];
    case "important":
      return [sql`EXISTS (SELECT 1 FROM json_each(${schema.emails.labelIds}) WHERE value = 'IMPORTANT')`];
    default:
      if (view.startsWith("Label_")) {
        return [sql`EXISTS (SELECT 1 FROM json_each(${schema.emails.labelIds}) WHERE value = ${view})`];
      }
      return [];
  }
}

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";

const emailSummaryColumns = {
  id: schema.emails.id,
  mailboxId: schema.emails.mailboxId,
  providerMessageId: schema.emails.providerMessageId,
  fromAddr: schema.emails.fromAddr,
  fromName: schema.emails.fromName,
  toAddr: schema.emails.toAddr,
  ccAddr: schema.emails.ccAddr,
  subject: schema.emails.subject,
  snippet: schema.emails.snippet,
  threadId: schema.emails.threadId,
  date: schema.emails.date,
  direction: schema.emails.direction,
  isRead: schema.emails.isRead,
  labelIds: schema.emails.labelIds,
  hasInbox: schema.emails.hasInbox,
  hasSent: schema.emails.hasSent,
  hasTrash: schema.emails.hasTrash,
  hasSpam: schema.emails.hasSpam,
  hasStarred: schema.emails.hasStarred,
  createdAt: schema.emails.createdAt,
  unsubscribeUrl: schema.emails.unsubscribeUrl,
  unsubscribeEmail: schema.emails.unsubscribeEmail,
  snoozedUntil: schema.emails.snoozedUntil,
} as const;

function toEmailListItem(row: EmailQueryRow) {
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
    isRead: row.isRead,
    labelIds,
    hasAttachment: labelIds.includes(HAS_ATTACHMENT_LABEL),
    createdAt: row.createdAt,
    unsubscribeUrl: row.unsubscribeUrl,
    unsubscribeEmail: row.unsubscribeEmail,
    snoozedUntil: row.snoozedUntil,
  };
}

export const localDb = {
  async ensureReady(): Promise<void> {
    await ensureDb();
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
    await ensureDb();
    const { userId, view = "inbox", mailboxId, limit = 100, offset = 0, cursor, search, isRead } = params;
    const now = Date.now();
    const conditions: SQL[] = [eq(schema.emails.userId, userId)];

    if (mailboxId != null) conditions.push(eq(schema.emails.mailboxId, mailboxId));

    if (isRead === "true") conditions.push(eq(schema.emails.isRead, true));
    else if (isRead === "false") conditions.push(eq(schema.emails.isRead, false));

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(schema.emails.subject, pattern),
          like(schema.emails.fromName, pattern),
          like(schema.emails.fromAddr, pattern),
          like(schema.emails.snippet, pattern),
        )!,
      );
    }

    conditions.push(...buildViewConditions(view, now));

    if (cursor != null) {
      conditions.push(lt(schema.emails.date, cursor));
    }

    const rowsWithExtra = await db
      .select({ ...emailSummaryColumns })
      .from(schema.emails)
      .where(and(...conditions))
      .orderBy(desc(schema.emails.date))
      .limit(limit + 1)
      .offset(cursor != null ? 0 : offset);

    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
    const lastRow = rows[rows.length - 1];

    return {
      data: rows.map((r) => toEmailListItem(r as unknown as EmailQueryRow)),
      pagination: {
        limit,
        offset,
        hasMore,
        cursor: lastRow?.date,
      },
    };
  },

  async getEmailDetail(userId: string, emailId: number) {
    await ensureDb();

    const rows = await db
      .select({
        ...emailSummaryColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.id, emailId)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      ...toEmailListItem(row as unknown as EmailQueryRow),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      resolvedBodyText: row.bodyText,
      resolvedBodyHtml: row.bodyHtml,
      attachments: [] as [],
    };
  },

  async getEmailThread(userId: string, threadId: string) {
    await ensureDb();

    const rows = await db
      .select({
        ...emailSummaryColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.threadId, threadId)))
      .orderBy(asc(schema.emails.date));

    return rows.map((row) => ({
      ...toEmailListItem(row as unknown as EmailQueryRow),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
    }));
  },

  async getDrafts(userId: string, mailboxId?: number) {
    await ensureDb();
    const conditions: SQL[] = [eq(schema.drafts.userId, userId)];
    if (mailboxId != null) conditions.push(eq(schema.drafts.mailboxId, mailboxId));

    const rows = await db
      .select()
      .from(schema.drafts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.drafts.updatedAt));

    return rows.map(({ userId: _, attachmentKeys, ...rest }) => ({
      ...rest,
      attachmentKeys: attachmentKeys ? JSON.parse(attachmentKeys) : null,
    }));
  },

  async getDraftByKey(userId: string, composeKey: string) {
    await ensureDb();

    const rows = await db
      .select()
      .from(schema.drafts)
      .where(and(eq(schema.drafts.userId, userId), eq(schema.drafts.composeKey, composeKey)))
      .limit(1);

    if (!rows[0]) return null;
    const { userId: _, attachmentKeys, ...rest } = rows[0];
    return { ...rest, attachmentKeys: attachmentKeys ? JSON.parse(attachmentKeys) : null };
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
    attachmentKeys?: Array<{ key: string; filename: string; mimeType: string }> | null;
  }) {
    await ensureDb();
    const now = Date.now();

    const inserted = await db
      .insert(schema.drafts)
      .values({
        userId: params.userId,
        composeKey: params.composeKey,
        mailboxId: params.mailboxId ?? null,
        toAddr: params.toAddr,
        ccAddr: params.ccAddr,
        bccAddr: params.bccAddr,
        subject: params.subject,
        body: params.body,
        forwardedContent: params.forwardedContent,
        threadId: params.threadId ?? null,
        attachmentKeys: params.attachmentKeys ? JSON.stringify(params.attachmentKeys) : null,
        updatedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.drafts.userId, schema.drafts.composeKey],
        set: {
          mailboxId: sql`excluded.mailbox_id`,
          toAddr: sql`excluded.to_addr`,
          ccAddr: sql`excluded.cc_addr`,
          bccAddr: sql`excluded.bcc_addr`,
          subject: sql`excluded.subject`,
          body: sql`excluded.body`,
          forwardedContent: sql`excluded.forwarded_content`,
          threadId: sql`excluded.thread_id`,
          attachmentKeys: sql`excluded.attachment_keys`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning();

    const { userId: _, attachmentKeys, ...rest } = inserted[0]!;
    return { ...rest, attachmentKeys: attachmentKeys ? JSON.parse(attachmentKeys) : null };
  },

  async deleteDraft(id: number, userId: string): Promise<void> {
    await ensureDb();
    await db
      .delete(schema.drafts)
      .where(and(eq(schema.drafts.id, id), eq(schema.drafts.userId, userId)));
  },

  async updateEmail(userId: string, emailId: number, patch: LocalEmailPatch): Promise<void> {
    await ensureDb();

    const rows = await db
      .select({
        isRead: schema.emails.isRead,
        labelIds: schema.emails.labelIds,
        snoozedUntil: schema.emails.snoozedUntil,
      })
      .from(schema.emails)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.id, emailId)))
      .limit(1);

    const current = rows[0];
    if (!current) return;

    const dbUpdates = applyEmailPatch(current, patch);
    if (Object.keys(dbUpdates).length === 0) return;

    await db
      .update(schema.emails)
      .set(dbUpdates)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.id, emailId)));
  },

  async updateEmails(userId: string, emailIds: number[], patch: LocalEmailPatch): Promise<void> {
    if (emailIds.length === 0) return;
    await ensureDb();

    const currentRows = await db
      .select({
        id: schema.emails.id,
        isRead: schema.emails.isRead,
        labelIds: schema.emails.labelIds,
        snoozedUntil: schema.emails.snoozedUntil,
      })
      .from(schema.emails)
      .where(and(eq(schema.emails.userId, userId), inArray(schema.emails.id, emailIds)));

    if (currentRows.length === 0) return;

    for (const current of currentRows) {
      const dbUpdates = applyEmailPatch(current, patch);
      if (Object.keys(dbUpdates).length === 0) continue;
      await db
        .update(schema.emails)
        .set(dbUpdates)
        .where(and(eq(schema.emails.userId, userId), eq(schema.emails.id, current.id)));
    }
  },

  async insertEmails(rows: EmailInsert[]): Promise<void> {
    if (!rows.length) return;
    await ensureDb();
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((row) => {
        const ids = typeof row.labelIds === "string"
          ? parseLabelIds(row.labelIds)
          : Array.isArray(row.labelIds) ? row.labelIds : [];
        return {
          ...row,
          labelIds: JSON.stringify(ids),
          ...labelBooleans(ids),
        };
      });
      await db
        .insert(schema.emails)
        .values(chunk)
        .onConflictDoUpdate({
          target: schema.emails.providerMessageId,
          set: {
            fromAddr: sql`excluded.from_addr`,
            fromName: sql`excluded.from_name`,
            toAddr: sql`excluded.to_addr`,
            ccAddr: sql`excluded.cc_addr`,
            subject: sql`excluded.subject`,
            snippet: sql`excluded.snippet`,
            bodyText: sql`excluded.body_text`,
            bodyHtml: sql`excluded.body_html`,
            isRead: sql`excluded.is_read`,
            labelIds: sql`excluded.label_ids`,
            hasInbox: sql`excluded.has_inbox`,
            hasSent: sql`excluded.has_sent`,
            hasTrash: sql`excluded.has_trash`,
            hasSpam: sql`excluded.has_spam`,
            hasStarred: sql`excluded.has_starred`,
            snoozedUntil: sql`excluded.snoozed_until`,
          },
      });
    }
  },

  async upsertSubscriptions(rows: SubscriptionInsert[]): Promise<void> {
    if (!rows.length) return;
    await ensureDb();
    await db
      .insert(schema.emailSubscriptions)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.emailSubscriptions.mailboxId, schema.emailSubscriptions.senderKey],
        set: {
          fromAddr: sql`excluded.from_addr`,
          fromName: sql`excluded.from_name`,
          unsubscribeUrl: sql`excluded.unsubscribe_url`,
          unsubscribeEmail: sql`excluded.unsubscribe_email`,
          status: sql`excluded.status`,
          emailCount: sql`excluded.email_count`,
          lastReceivedAt: sql`excluded.last_received_at`,
          unsubscribeMethod: sql`excluded.unsubscribe_method`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  },

  async getSubscriptions(userId: string, status?: string) {
    await ensureDb();
    const conditions: SQL[] = [eq(schema.emailSubscriptions.userId, userId)];
    if (status) {
      conditions.push(
        eq(schema.emailSubscriptions.status, status as typeof schema.emailSubscriptions.$inferSelect.status),
      );
    }

    return db
      .select()
      .from(schema.emailSubscriptions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.emailSubscriptions.lastReceivedAt));
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
    await ensureDb();
    const { userId, query, mailboxId, view, limit = 30, offset = 0, includeJunk = false } = params;
    const pattern = `%${query}%`;
    const searchCondition = or(
      like(schema.emails.subject, pattern),
      like(schema.emails.fromName, pattern),
      like(schema.emails.fromAddr, pattern),
      like(schema.emails.snippet, pattern),
    )!;
    const baseConditions: SQL[] = [
      eq(schema.emails.userId, userId),
      searchCondition,
    ];

    if (mailboxId != null) baseConditions.push(eq(schema.emails.mailboxId, mailboxId));

    const conditions = [...baseConditions];
    if (view) {
      conditions.push(...buildViewConditions(view, Date.now()));
    } else if (!includeJunk) {
      conditions.push(eq(schema.emails.hasSpam, false));
      conditions.push(eq(schema.emails.hasTrash, false));
    }

    const rowsWithExtra = await db
      .select({ ...emailSummaryColumns })
      .from(schema.emails)
      .where(and(...conditions))
      .orderBy(desc(schema.emails.date))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
    let hiddenJunkCount = 0;

    if (!includeJunk && !view) {
      const hiddenRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.emails)
        .where(and(...baseConditions, or(eq(schema.emails.hasSpam, true), eq(schema.emails.hasTrash, true))!));
      hiddenJunkCount = hiddenRows[0]?.count ?? 0;
    }

    return {
      data: rows.map((r) => toEmailListItem(r as unknown as EmailQueryRow)),
      pagination: { limit, offset, hasMore },
      searchMeta: { hiddenJunkCount },
    };
  },

  async getContactSuggestions(userId: string, query: string, limit?: number) {
    await ensureDb();
    const pattern = `%${query}%`;
    const rows = await db
      .select({
        fromAddr: schema.emails.fromAddr,
        fromName: schema.emails.fromName,
        lastDate: sql<number>`max(${schema.emails.date})`,
        count: sql<number>`count(*)`,
      })
      .from(schema.emails)
      .where(
        and(
          eq(schema.emails.userId, userId),
          or(like(schema.emails.fromAddr, pattern), like(schema.emails.fromName, pattern)),
        ),
      )
      .groupBy(schema.emails.fromAddr, schema.emails.fromName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit ?? 8);

    return rows.map((r) => ({
      email: r.fromAddr,
      name: r.fromName,
      avatarUrl: null as string | null,
      lastInteractionAt: r.lastDate,
      interactionCount: r.count,
    }));
  },

  async getSearchSuggestions(params: {
    userId: string;
    query: string;
    mailboxId?: number;
    view?: ViewFilter;
  }) {
    await ensureDb();
    const { userId, query: rawQuery, mailboxId, view } = params;
    const normalized = rawQuery.trim();

    const contacts = normalized
      ? await localDb.getContactSuggestions(userId, normalized, 6)
      : [];

    const conditions: SQL[] = [eq(schema.emails.userId, userId)];
    if (mailboxId != null) conditions.push(eq(schema.emails.mailboxId, mailboxId));
    if (view) conditions.push(...buildViewConditions(view, Date.now()));

    const subjectPattern = `%${normalized}%`;
    const subjectRows = normalized
      ? await db
          .select({
            subject: schema.emails.subject,
            lastUsedAt: sql<number>`max(${schema.emails.date})`,
          })
          .from(schema.emails)
          .where(
            and(
              ...conditions,
              sql`coalesce(${schema.emails.subject}, '') <> ''`,
              like(schema.emails.subject, subjectPattern),
            ),
          )
          .groupBy(schema.emails.subject)
          .orderBy(desc(sql`max(${schema.emails.date})`))
          .limit(8)
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
        .filter((row): row is typeof row & { subject: string } => row.subject !== null)
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
    await ensureDb();
    return db
      .select({
        gmailId: schema.labels.gmailId,
        name: schema.labels.name,
        type: schema.labels.type,
        textColor: schema.labels.textColor,
        backgroundColor: schema.labels.backgroundColor,
        messagesTotal: schema.labels.messagesTotal,
        messagesUnread: schema.labels.messagesUnread,
      })
      .from(schema.labels)
      .where(
        and(
          eq(schema.labels.userId, userId),
          eq(schema.labels.mailboxId, mailboxId),
        ),
      )
      .orderBy(asc(schema.labels.name));
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
    await ensureDb();
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

    await db
      .insert(schema.labels)
      .values(rows)
      .onConflictDoUpdate({
        target: schema.labels.gmailId,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          textColor: sql`excluded.text_color`,
          backgroundColor: sql`excluded.background_color`,
          messagesTotal: sql`excluded.messages_total`,
          messagesUnread: sql`excluded.messages_unread`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  },

  async deleteLabel(gmailId: string): Promise<void> {
    await ensureDb();
    await db.delete(schema.labels).where(eq(schema.labels.gmailId, gmailId));
  },

  async setMeta(key: string, value: string): Promise<void> {
    await ensureDb();
    await execSql(
      "INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?",
      [key, value, value],
      "run",
    );
  },

  async getMeta(key: string): Promise<string | null> {
    await ensureDb();
    const result = await execSql(
      "SELECT value FROM _meta WHERE key = ?",
      [key],
      "get",
    );
    const row = result.rows[0] as [string] | undefined;
    return row?.[0] ?? null;
  },

  async clear(): Promise<void> {
    await ensureDb();
    await db.delete(schema.emailSubscriptions);
    await db.delete(schema.labels);
    await db.delete(schema.drafts);
    await db.delete(schema.emails);
    await execSql("DELETE FROM _meta", [], "run");
  },

  async deleteDatabase(): Promise<void> {
    await ensureDb();
    await deleteSqliteDb();
  },
};
