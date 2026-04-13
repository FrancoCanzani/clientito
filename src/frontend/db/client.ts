import { PGlite } from "@electric-sql/pglite";
import { type SQL, and, asc, desc, eq, gt, isNull, like, lte, or, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core/dialect";
import { drizzle } from "drizzle-orm/pglite";
import type {
  EmailDetailIntelligence,
} from "@/features/email/inbox/types";
import migrations from "./migrations/export.json";
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
type IntelligenceInsert = typeof schema.emailIntelligence.$inferInsert;
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
  labelIds: string[] | null;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
};

let pg: PGlite | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<void> | null = null;

async function destroyIdb() {
  const dbs = await indexedDB.databases();
  for (const entry of dbs) {
    if (entry.name?.startsWith("/petit")) {
      indexedDB.deleteDatabase(entry.name);
    }
  }
}

const DB_NAME = "petit";

async function initPglite() {
  pg = new PGlite(`idb://${DB_NAME}`);
  db = drizzle(pg, { schema });

  const start = performance.now();
  try {
    // @ts-expect-error db._.session typing mismatch with migrate's Session param
    await new PgDialect().migrate(migrations, db._.session, DB_NAME);
    console.info(`✅ Local database ready in ${performance.now() - start}ms`);
  } catch (cause) {
    console.error("❌ Local database schema migration failed", cause);
    throw cause;
  }

  navigator.storage.persist().catch(() => {});
}

async function ensureDb() {
  if (db) return db;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initPglite();
      } catch {
        pg = null;
        db = null;
        await destroyIdb();
        await initPglite();
      }
    })();
  }

  await initPromise;
  return db!;
}

function hasLabel(label: string) {
  return sql<boolean>`${schema.emails.labelIds}::jsonb @> ${JSON.stringify([label])}::jsonb`;
}

const STANDARD_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  SPAM: "SPAM",
  TRASH: "TRASH",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
} as const;

function areLabelIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, i) => value === right[i]);
}

function applyEmailPatch(
  current: { isRead: boolean; labelIds: string[] | null; snoozedUntil: number | null },
  patch: LocalEmailPatch,
) {
  const currentLabelIds = current.labelIds ?? [];
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
    dbUpdates.labelIds = patch.labelIds;
    return dbUpdates;
  }

  const resolvedLabelIds = Array.from(nextLabelIds);
  if (!areLabelIdsEqual(currentLabelIds, resolvedLabelIds)) {
    dbUpdates.labelIds = resolvedLabelIds;
  }

  return dbUpdates;
}

function buildViewConditions(view: ViewFilter, now: number): SQL[] {
  switch (view) {
    case "inbox": {
      const snoozeCondition = or(isNull(schema.emails.snoozedUntil), lte(schema.emails.snoozedUntil, now));
      return snoozeCondition
        ? [hasLabel("INBOX"), snoozeCondition]
        : [hasLabel("INBOX")];
    }
    case "sent":
      return [hasLabel("SENT")];
    case "spam":
      return [hasLabel("SPAM")];
    case "trash":
      return [hasLabel("TRASH")];
    case "snoozed":
      return [gt(schema.emails.snoozedUntil, now)];
    case "archived":
      return [
        sql<boolean>`not (${hasLabel("INBOX")})`,
        sql<boolean>`not (${hasLabel("SENT")})`,
        sql<boolean>`not (${hasLabel("TRASH")})`,
        sql<boolean>`not (${hasLabel("SPAM")})`,
      ];
    case "starred":
      return [hasLabel("STARRED")];
    case "important":
      return [hasLabel("IMPORTANT")];
    default:
      if (view.startsWith("Label_")) {
        return [hasLabel(view)];
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
  createdAt: schema.emails.createdAt,
  unsubscribeUrl: schema.emails.unsubscribeUrl,
  unsubscribeEmail: schema.emails.unsubscribeEmail,
  snoozedUntil: schema.emails.snoozedUntil,
} as const;

function toEmailListItem(row: EmailQueryRow) {
  const labelIds = row.labelIds ?? [];

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
    search?: string;
    isRead?: "true" | "false";
  }) {
    const d = await ensureDb();
    const { userId, view = "inbox", mailboxId, limit = 100, offset = 0, search, isRead } = params;
    const now = Date.now();
    const conditions: unknown[] = [eq(schema.emails.userId, userId)];

    if (mailboxId != null) conditions.push(eq(schema.emails.mailboxId, mailboxId));

    if (isRead === "true") conditions.push(eq(schema.emails.isRead, true));
    else if (isRead === "false") conditions.push(eq(schema.emails.isRead, false));

    if (search) {
      conditions.push(
        sql<boolean>`search_vector @@ plainto_tsquery('english', ${search})`,
      );
    }

    conditions.push(...buildViewConditions(view, now));

    const rowsWithExtra = await d
      .select({ ...emailSummaryColumns })
      .from(schema.emails)
      .where(and(...(conditions as [])))
      .orderBy(desc(schema.emails.date))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;

    return {
      data: rows.map(toEmailListItem),
      pagination: { limit, offset, hasMore },
    };
  },

  async getEmailDetail(userId: string, emailId: number) {
    const d = await ensureDb();

    const rows = await d
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
      ...toEmailListItem(row),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      resolvedBodyText: row.bodyText,
      resolvedBodyHtml: row.bodyHtml,
      attachments: [] as [],
    };
  },

  async getEmailDetailAI(userId: string, emailId: number) {
    const d = await ensureDb();

    const rows = await d
      .select({
        summary: schema.emailIntelligence.summary,
        suspiciousJson: schema.emailIntelligence.suspiciousJson,
        actionsJson: schema.emailIntelligence.actionsJson,
      })
      .from(schema.emailIntelligence)
      .where(
        and(
          eq(schema.emailIntelligence.userId, userId),
          eq(schema.emailIntelligence.emailId, emailId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const actions = Array.isArray(row.actionsJson) ? row.actionsJson : [];
    const replyAction = actions.find(
      (action): action is { type: "reply"; status: "pending"; payload?: { draft?: string } } =>
        typeof action === "object" &&
        action !== null &&
        (action as { type?: unknown }).type === "reply" &&
        (action as { status?: unknown }).status === "pending",
    );

    const replyDraft =
      typeof replyAction?.payload?.draft === "string" ? replyAction.payload.draft : null;

    const result: EmailDetailIntelligence = {
      summary: row.summary ?? null,
      isSuspicious: row.suspiciousJson?.isSuspicious ?? false,
      replyDraft,
    };

    return result;
  },

  async cacheEmailDetailAI(
    userId: string,
    emailId: number,
    data: EmailDetailIntelligence,
  ) {
    const d = await ensureDb();
    const now = Date.now();
    const actionsJson: unknown[] = data.replyDraft
      ? [{ type: "reply", status: "pending", payload: { draft: data.replyDraft } }]
      : [];

    await d
      .insert(schema.emailIntelligence)
      .values({
        emailId,
        userId,
        summary: data.summary,
        suspiciousJson: { isSuspicious: data.isSuspicious },
        actionsJson,
        status: "ready",
        schemaVersion: 1,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.emailIntelligence.emailId,
        set: {
          summary: data.summary,
          suspiciousJson: { isSuspicious: data.isSuspicious },
          actionsJson,
          status: "ready",
          updatedAt: now,
        },
      });
  },

  async getEmailThread(userId: string, threadId: string) {
    const d = await ensureDb();

    const rows = await d
      .select({
        ...emailSummaryColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.threadId, threadId)))
      .orderBy(asc(schema.emails.date));

    return rows.map((row) => ({
      ...toEmailListItem(row),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
    }));
  },

  async getDrafts(userId: string, mailboxId?: number) {
    const d = await ensureDb();
    const conditions = [eq(schema.drafts.userId, userId)];
    if (mailboxId != null) conditions.push(eq(schema.drafts.mailboxId, mailboxId));

    const rows = await d
      .select()
      .from(schema.drafts)
      .where(conditions.length ? and(...(conditions as [])) : undefined)
      .orderBy(desc(schema.drafts.updatedAt));

    return rows.map(({ userId: _, ...rest }) => rest);
  },

  async getDraftByKey(userId: string, composeKey: string) {
    const d = await ensureDb();

    const rows = await d
      .select()
      .from(schema.drafts)
      .where(and(eq(schema.drafts.userId, userId), eq(schema.drafts.composeKey, composeKey)))
      .limit(1);

    if (!rows[0]) return null;
    const { userId: _, ...rest } = rows[0];
    return rest;
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
    const d = await ensureDb();
    const now = Date.now();

    const existing = await d
      .select({ id: schema.drafts.id })
      .from(schema.drafts)
      .where(
        and(eq(schema.drafts.userId, params.userId), eq(schema.drafts.composeKey, params.composeKey)),
      )
      .limit(1);

    if (existing[0]) {
      await d
        .update(schema.drafts)
        .set({
          mailboxId: params.mailboxId ?? null,
          toAddr: params.toAddr,
          ccAddr: params.ccAddr,
          bccAddr: params.bccAddr,
          subject: params.subject,
          body: params.body,
          forwardedContent: params.forwardedContent,
          threadId: params.threadId ?? null,
          attachmentKeys: params.attachmentKeys ?? null,
          updatedAt: now,
        })
        .where(eq(schema.drafts.id, existing[0].id));

      const rows = await d
        .select()
        .from(schema.drafts)
        .where(eq(schema.drafts.id, existing[0].id))
        .limit(1);
      const { userId: _, ...rest } = rows[0]!;
      return rest;
    }

    const inserted = await d
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
        attachmentKeys: params.attachmentKeys ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: schema.drafts.id });

    const rows = await d
      .select()
      .from(schema.drafts)
      .where(eq(schema.drafts.id, inserted[0]!.id))
      .limit(1);
    const { userId: _, ...rest } = rows[0]!;
    return rest;
  },

  async deleteDraft(id: number, userId: string): Promise<void> {
    const d = await ensureDb();
    await d
      .delete(schema.drafts)
      .where(and(eq(schema.drafts.id, id), eq(schema.drafts.userId, userId)));
  },

  async updateEmail(userId: string, emailId: number, patch: LocalEmailPatch): Promise<void> {
    const d = await ensureDb();

    const rows = await d
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

    await d
      .update(schema.emails)
      .set(dbUpdates)
      .where(and(eq(schema.emails.userId, userId), eq(schema.emails.id, emailId)));
  },

  async updateEmails(userId: string, emailIds: number[], patch: LocalEmailPatch): Promise<void> {
    for (const id of emailIds) {
      await localDb.updateEmail(userId, id, patch);
    }
  },

  async insertEmails(rows: EmailInsert[]): Promise<void> {
    if (!rows.length) return;
    const d = await ensureDb();
    for (const row of rows) {
      await d
        .insert(schema.emails)
        .values(row)
        .onConflictDoUpdate({
          target: schema.emails.providerMessageId,
          set: {
            fromAddr: row.fromAddr,
            fromName: row.fromName,
            toAddr: row.toAddr,
            ccAddr: row.ccAddr,
            subject: row.subject,
            snippet: row.snippet,
            bodyText: row.bodyText,
            bodyHtml: row.bodyHtml,
            isRead: row.isRead,
            labelIds: row.labelIds,
            snoozedUntil: row.snoozedUntil,
          },
        });
    }
  },

  async insertEmailIntelligence(rows: IntelligenceInsert[]): Promise<void> {
    if (!rows.length) return;
    const d = await ensureDb();
    for (const row of rows) {
      await d
        .insert(schema.emailIntelligence)
        .values(row)
        .onConflictDoUpdate({
          target: schema.emailIntelligence.emailId,
          set: {
            category: row.category,
            summary: row.summary,
            suspiciousJson: row.suspiciousJson,
            actionsJson: row.actionsJson,
            status: row.status,
            sourceHash: row.sourceHash,
            model: row.model,
            schemaVersion: row.schemaVersion,
            error: row.error,
            lastProcessedAt: row.lastProcessedAt,
            updatedAt: row.updatedAt,
          },
        });
    }
  },

  async upsertSubscriptions(rows: SubscriptionInsert[]): Promise<void> {
    if (!rows.length) return;
    const d = await ensureDb();
    for (const row of rows) {
      await d
        .insert(schema.emailSubscriptions)
        .values(row)
        .onConflictDoUpdate({
          target: [schema.emailSubscriptions.mailboxId, schema.emailSubscriptions.senderKey],
          set: {
            fromAddr: row.fromAddr,
            fromName: row.fromName,
            unsubscribeUrl: row.unsubscribeUrl,
            unsubscribeEmail: row.unsubscribeEmail,
            status: row.status,
            emailCount: row.emailCount,
            lastReceivedAt: row.lastReceivedAt,
            unsubscribeMethod: row.unsubscribeMethod,
            updatedAt: row.updatedAt,
          },
        });
    }
  },

  async getSubscriptions(userId: string, status?: string) {
    const d = await ensureDb();
    const conditions = [eq(schema.emailSubscriptions.userId, userId)];
    if (status) {
      conditions.push(
        eq(schema.emailSubscriptions.status, status as typeof schema.emailSubscriptions.$inferSelect.status),
      );
    }

    return d
      .select()
      .from(schema.emailSubscriptions)
      .where(conditions.length ? and(...(conditions as [])) : undefined)
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
    const d = await ensureDb();
    const { userId, query, mailboxId, view, limit = 30, offset = 0, includeJunk = false } = params;
    const ftsCondition = sql<boolean>`search_vector @@ plainto_tsquery('english', ${query})`;
    const baseConditions: unknown[] = [
      eq(schema.emails.userId, userId),
      ftsCondition,
    ];

    if (mailboxId != null) baseConditions.push(eq(schema.emails.mailboxId, mailboxId));

    const conditions = [...baseConditions];
    if (view) {
      conditions.push(...buildViewConditions(view, Date.now()));
    } else if (!includeJunk) {
      conditions.push(sql<boolean>`not (${hasLabel("SPAM")})`);
      conditions.push(sql<boolean>`not (${hasLabel("TRASH")})`);
    }

    const tsRank = sql`ts_rank(search_vector, plainto_tsquery('english', ${query}))`;

    const rowsWithExtra = await d
      .select({ ...emailSummaryColumns })
      .from(schema.emails)
      .where(and(...(conditions as [])))
      .orderBy(desc(tsRank))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
    let hiddenJunkCount = 0;

    if (!includeJunk && !view) {
      const hiddenRows = await d
        .select({ count: sql<number>`count(*)` })
        .from(schema.emails)
        .where(and(...(baseConditions as []), or(hasLabel("SPAM"), hasLabel("TRASH"))!));
      hiddenJunkCount = hiddenRows[0]?.count ?? 0;
    }

    return {
      data: rows.map(toEmailListItem),
      pagination: { limit, offset, hasMore },
      searchMeta: { hiddenJunkCount },
    };
  },

  async getContactSuggestions(userId: string, query: string, limit?: number) {
    const d = await ensureDb();
    const pattern = `%${query}%`;
    const rows = await d
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
    const d = await ensureDb();
    const { userId, query: rawQuery, mailboxId, view } = params;
    const normalized = rawQuery.trim();

    const contacts = normalized
      ? await localDb.getContactSuggestions(userId, normalized, 6)
      : [];

    const conditions: unknown[] = [eq(schema.emails.userId, userId)];
    if (mailboxId != null) conditions.push(eq(schema.emails.mailboxId, mailboxId));
    if (view) conditions.push(...buildViewConditions(view, Date.now()));

    const subjectPattern = `%${normalized}%`;
    const subjectRows = normalized
      ? await d
          .select({
            subject: schema.emails.subject,
            lastUsedAt: sql<number>`max(${schema.emails.date})`,
          })
          .from(schema.emails)
          .where(
            and(
              ...(conditions as []),
              sql<boolean>`coalesce(${schema.emails.subject}, '') <> ''`,
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
    const d = await ensureDb();
    return d
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
    const d = await ensureDb();
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

    await d
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
    const d = await ensureDb();
    await d.delete(schema.labels).where(eq(schema.labels.gmailId, gmailId));
  },

  async setMeta(key: string, value: string): Promise<void> {
    const d = await ensureDb();
    await d.execute(
      sql`INSERT INTO _meta (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = ${value}`,
    );
  },

  async getMeta(key: string): Promise<string | null> {
    const d = await ensureDb();
    const result = await d.execute(
      sql`SELECT value FROM _meta WHERE key = ${key}`,
    );
    const row = result.rows[0] as { value: string } | undefined;
    return row?.value ?? null;
  },

  async clear(): Promise<void> {
    const d = await ensureDb();
    await d.delete(schema.emailIntelligence);
    await d.delete(schema.emailSubscriptions);
    await d.delete(schema.labels);
    await d.delete(schema.drafts);
    await d.delete(schema.emails);
    await d.execute(sql`DELETE FROM _meta`);
  },

};
