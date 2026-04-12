import { PGlite } from "@electric-sql/pglite";
import { type SQL, and, asc, desc, eq, gt, isNull, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type {
  EmailDetailIntelligence,
  EmailIntelligenceCategory,
} from "@/features/email/inbox/types";
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

  | EmailIntelligenceCategory;

const CATEGORY_VIEWS = new Set<string>([
  "to_respond",
  "to_follow_up",
  "fyi",
  "notification",
  "invoice",
  "marketing",
]);

type EmailInsert = typeof schema.emails.$inferInsert;
type IntelligenceInsert = typeof schema.emailIntelligence.$inferInsert;
type SubscriptionInsert = typeof schema.emailSubscriptions.$inferInsert;

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
  intelligenceStatus: "pending" | "ready" | "error" | null;
  intelligenceCategory: EmailIntelligenceCategory | null;
  intelligenceSuspiciousJson: { isSuspicious: boolean } | null;
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

async function initPglite() {
  pg = new PGlite("idb://petit");
  db = drizzle(pg, { schema });
  await bootstrapSchema();
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

async function bootstrapSchema() {
  const SCHEMA_VERSION = 4;

  await pg!.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const versionResult = await pg!.query<{ value: string }>(
    "SELECT value FROM _meta WHERE key = 'schema_version'"
  );
  const currentVersion = versionResult.rows.length > 0
    ? parseInt(versionResult.rows[0].value, 10)
    : 0;

  if (currentVersion < SCHEMA_VERSION) {
    await pg!.exec(`
      DROP TABLE IF EXISTS emails CASCADE;
      DROP TABLE IF EXISTS email_intelligence CASCADE;
      DROP TABLE IF EXISTS email_subscriptions CASCADE;
      DROP TABLE IF EXISTS drafts CASCADE;
      DELETE FROM _meta WHERE key != 'schema_version';
    `);
  }

  await pg!.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      mailbox_id INTEGER,
      provider_message_id TEXT NOT NULL UNIQUE,
      thread_id TEXT,
      from_addr TEXT NOT NULL,
      from_name TEXT,
      to_addr TEXT,
      cc_addr TEXT,
      subject TEXT,
      snippet TEXT,
      body_text TEXT,
      body_html TEXT,
      date BIGINT NOT NULL,
      direction TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      label_ids JSONB,
      unsubscribe_url TEXT,
      unsubscribe_email TEXT,
      snoozed_until BIGINT,
      created_at BIGINT NOT NULL,
      search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(from_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(from_addr, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(snippet, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(body_text, '')), 'D')
      ) STORED
    );
    CREATE INDEX IF NOT EXISTS emails_date_idx ON emails(date);
    CREATE INDEX IF NOT EXISTS emails_thread_idx ON emails(thread_id);
    CREATE INDEX IF NOT EXISTS emails_snoozed_idx ON emails(snoozed_until);
    CREATE INDEX IF NOT EXISTS emails_mailbox_date_idx ON emails(mailbox_id, date);
    CREATE INDEX IF NOT EXISTS emails_search_idx ON emails USING gin(search_vector);

    CREATE TABLE IF NOT EXISTS email_intelligence (
      id SERIAL PRIMARY KEY,
      email_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      mailbox_id INTEGER,
      category TEXT,
      summary TEXT,
      suspicious_json JSONB NOT NULL DEFAULT '{"isSuspicious":false}',
      actions_json JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      source_hash TEXT,
      model TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      last_processed_at BIGINT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS email_intelligence_email_idx ON email_intelligence(email_id);
    CREATE INDEX IF NOT EXISTS email_intelligence_status_idx ON email_intelligence(status);

    CREATE TABLE IF NOT EXISTS email_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      mailbox_id INTEGER,
      sender_key TEXT NOT NULL,
      from_addr TEXT NOT NULL,
      from_name TEXT,
      unsubscribe_url TEXT,
      unsubscribe_email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      email_count INTEGER NOT NULL DEFAULT 0,
      last_received_at BIGINT,
      unsubscribe_method TEXT,
      unsubscribe_requested_at BIGINT,
      unsubscribed_at BIGINT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE(mailbox_id, sender_key)
    );
    CREATE INDEX IF NOT EXISTS email_subscriptions_status_idx ON email_subscriptions(status);

    CREATE TABLE IF NOT EXISTS drafts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      compose_key TEXT NOT NULL,
      mailbox_id INTEGER,
      to_addr TEXT NOT NULL DEFAULT '',
      cc_addr TEXT NOT NULL DEFAULT '',
      bcc_addr TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      forwarded_content TEXT NOT NULL DEFAULT '',
      thread_id TEXT,
      attachment_keys JSONB,
      updated_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, compose_key)
    );
    CREATE INDEX IF NOT EXISTS drafts_updated_idx ON drafts(updated_at);
  `);

  await pg!.exec(
    `INSERT INTO _meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')
     ON CONFLICT (key) DO UPDATE SET value = '${SCHEMA_VERSION}'`
  );
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
  if (CATEGORY_VIEWS.has(view)) {
    return [sql<boolean>`${schema.emailIntelligence.category} = ${view}`];
  }

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
    default:
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

const intelligenceColumns = {
  intelligenceStatus: schema.emailIntelligence.status,
  intelligenceCategory: schema.emailIntelligence.category,
  intelligenceSuspiciousJson: schema.emailIntelligence.suspiciousJson,
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
    intelligenceStatus: row.intelligenceStatus,
    intelligence:
      row.intelligenceStatus === "ready" && row.intelligenceCategory
        ? {
            category: row.intelligenceCategory,
            isSuspicious: row.intelligenceSuspiciousJson?.isSuspicious ?? false,
          }
        : null,
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
      .select({ ...emailSummaryColumns, ...intelligenceColumns })
      .from(schema.emails)
      .leftJoin(schema.emailIntelligence, eq(schema.emailIntelligence.emailId, schema.emails.id))
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
        ...intelligenceColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .leftJoin(schema.emailIntelligence, eq(schema.emailIntelligence.emailId, schema.emails.id))
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
        ...intelligenceColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .leftJoin(schema.emailIntelligence, eq(schema.emailIntelligence.emailId, schema.emails.id))
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
      .select({ ...emailSummaryColumns, ...intelligenceColumns })
      .from(schema.emails)
      .leftJoin(schema.emailIntelligence, eq(schema.emailIntelligence.emailId, schema.emails.id))
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
    await d.delete(schema.drafts);
    await d.delete(schema.emails);
    await d.execute(sql`DELETE FROM _meta`);
  },

  async countEmailsMissingIntelligence(userId: string, mailboxId: number): Promise<number> {
    const d = await ensureDb();
    const result = await d
      .select({ count: sql<number>`count(*)` })
      .from(schema.emails)
      .leftJoin(schema.emailIntelligence, eq(schema.emailIntelligence.emailId, schema.emails.id))
      .where(
        and(
          eq(schema.emails.userId, userId),
          eq(schema.emails.mailboxId, mailboxId),
          or(
            isNull(schema.emailIntelligence.emailId),
            sql<boolean>`${schema.emailIntelligence.status} != 'ready'`,
          ),
        ),
      );
    return Number(result[0]?.count ?? 0);
  },
};
