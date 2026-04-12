import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import wasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";
import * as SQLite from "wa-sqlite";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { and, asc, desc, eq, like, or, sql, lte, gt, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { EmailDetailIntelligence } from "@/features/email/inbox/types";

const DB_NAME = "petit";

let sqlite3: SQLiteAPI;
let dbHandle: number;

async function execute(sqlText: string, params: unknown[], method: string) {
  const rows: Record<string, unknown>[] = [];

  // wa-sqlite doesn't handle undefined — normalize to null so JSON columns
  // aren't stored as the literal string "undefined" (which breaks JSON.parse).
  const safeParams = params.map((p) => (p === undefined ? null : p));

  for await (const stmt of sqlite3.statements(dbHandle, sqlText)) {
    if (safeParams.length) {
      sqlite3.bind_collection(
        stmt,
        safeParams as Array<SQLiteCompatibleType | null>,
      );
    }

    const colCount = sqlite3.column_count(stmt);
    const cols: string[] = [];
    for (let i = 0; i < colCount; i++) {
      cols.push(sqlite3.column_name(stmt, i));
    }

    while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      const row: Record<string, unknown> = {};
      for (let i = 0; i < colCount; i++) {
        row[cols[i]] = sqlite3.column(stmt, i) ?? null;
      }
      rows.push(row);
    }
  }

  if (method === "get") {
    return { rows: rows.slice(0, 1) };
  }

  if (method === "run") {
    return { rows: [] };
  }

  return { rows };
}

const db = drizzle(
  (sqlText, params, method) => execute(sqlText, params, method),
  { schema, casing: "snake_case" },
);

async function bootstrapSchema() {
  await execute(
    `
  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    mailbox_id INTEGER,
    provider_message_id TEXT NOT NULL UNIQUE,
    thread_id TEXT,
    message_id TEXT,
    from_addr TEXT NOT NULL,
    from_name TEXT,
    to_addr TEXT,
    cc_addr TEXT,
    subject TEXT,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    date INTEGER NOT NULL,
    direction TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    label_ids TEXT DEFAULT '[]',
    unsubscribe_url TEXT,
    unsubscribe_email TEXT,
    snoozed_until INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS emails_date_idx ON emails(date);
  CREATE INDEX IF NOT EXISTS emails_thread_idx ON emails(thread_id);
  CREATE INDEX IF NOT EXISTS emails_snoozed_idx ON emails(snoozed_until);
  CREATE INDEX IF NOT EXISTS emails_mailbox_date_idx ON emails(mailbox_id, date);

  CREATE TABLE IF NOT EXISTS email_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    mailbox_id INTEGER,
    category TEXT,
    urgency TEXT,
    summary TEXT,
    suspicious_json TEXT NOT NULL DEFAULT '{"isSuspicious":false,"kind":null,"reason":null,"confidence":null}',
    actions_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    source_hash TEXT,
    model TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    last_processed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS email_intelligence_status_idx ON email_intelligence(status);

  CREATE TABLE IF NOT EXISTS email_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    mailbox_id INTEGER,
    sender_key TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    from_name TEXT,
    unsubscribe_url TEXT,
    unsubscribe_email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    email_count INTEGER NOT NULL DEFAULT 0,
    last_received_at INTEGER,
    unsubscribe_method TEXT,
    unsubscribe_requested_at INTEGER,
    unsubscribed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(mailbox_id, sender_key)
  );
  CREATE INDEX IF NOT EXISTS email_subscriptions_status_idx ON email_subscriptions(status);

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    attachment_keys TEXT,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, compose_key)
  );
  CREATE INDEX IF NOT EXISTS drafts_updated_idx ON drafts(updated_at);

  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,
    [],
    "run",
  );
}

async function initDatabase() {
  const module = await SQLiteESMFactory({
    locateFile(file: string) {
      if (file === "wa-sqlite-async.wasm") {
        return wasmUrl;
      }
      return file;
    },
  });
  sqlite3 = SQLite.Factory(module);

  const vfs = new IDBBatchAtomicVFS(DB_NAME);
  sqlite3.vfs_register(vfs as unknown as SQLiteVFS, true);
  dbHandle = await sqlite3.open_v2(
    "petit.sqlite3",
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    DB_NAME,
  );

  await execute("PRAGMA journal_mode=DELETE", [], "run");
  await execute("PRAGMA synchronous=NORMAL", [], "run");
  await bootstrapSchema();
  await repairUndefinedJsonValues();
}

async function repairUndefinedJsonValues() {
  await execute(
    `UPDATE emails SET label_ids = '[]' WHERE label_ids = 'undefined'`,
    [],
    "run",
  );
  await execute(
    `UPDATE email_intelligence SET suspicious_json = '{"isSuspicious":false,"kind":null,"reason":null,"confidence":null}' WHERE suspicious_json = 'undefined'`,
    [],
    "run",
  );
  await execute(
    `UPDATE email_intelligence SET actions_json = '[]' WHERE actions_json = 'undefined'`,
    [],
    "run",
  );
  await execute(
    `UPDATE drafts SET attachment_keys = NULL WHERE attachment_keys = 'undefined'`,
    [],
    "run",
  );
}

function hasLabel(label: string) {
  return sql<boolean>`exists(
    select 1 from json_each(coalesce(${schema.emails.labelIds}, '[]'))
    where value = ${label}
  )`;
}

type ViewFilter =
  | "inbox"
  | "sent"
  | "spam"
  | "trash"
  | "snoozed"
  | "archived"
  | "starred"
  | "important";

type EmailPatchMutation = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
  snoozedUntil?: number | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  labelIds?: string[] | null;
};

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
  return left.every((value, index) => value === right[index]);
}

function applyEmailPatch(
  current: { isRead: boolean; labelIds: string[] | null; snoozedUntil: number | null },
  patch: EmailPatchMutation,
) {
  const currentLabelIds = current.labelIds ?? [];
  const nextLabelIds = new Set(currentLabelIds);
  const dbUpdates: Record<string, unknown> = {};

  const queueAdd = (labelId: string) => {
    nextLabelIds.add(labelId);
  };
  const queueRemove = (labelId: string) => {
    nextLabelIds.delete(labelId);
  };

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

  if (patch.snoozedUntil !== undefined) {
    dbUpdates.snoozedUntil = patch.snoozedUntil;
  }

  if (patch.bodyText !== undefined) {
    dbUpdates.bodyText = patch.bodyText;
  }
  if (patch.bodyHtml !== undefined) {
    dbUpdates.bodyHtml = patch.bodyHtml;
  }
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

function buildViewConditions(view: ViewFilter, now: number) {
  switch (view) {
    case "inbox":
      return [
        hasLabel("INBOX"),
        or(isNull(schema.emails.snoozedUntil), lte(schema.emails.snoozedUntil, now)),
      ];
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
        sql<boolean>`not ${hasLabel("INBOX")}`,
        sql<boolean>`not ${hasLabel("SENT")}`,
        sql<boolean>`not ${hasLabel("TRASH")}`,
        sql<boolean>`not ${hasLabel("SPAM")}`,
      ];
    case "starred":
      return [hasLabel("STARRED")];
    case "important":
      return [
        sql<boolean>`${schema.emailIntelligence.category} in ('important', 'action_needed')`,
      ];
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
  intelligenceUrgency: schema.emailIntelligence.urgency,
  intelligenceSuspiciousJson: schema.emailIntelligence.suspiciousJson,
} as const;

function toEmailListItem(row: Record<string, unknown>) {
  const labelIds = (row.labelIds as string[] | null) ?? [];
  const status = row.intelligenceStatus as string | null;
  const category = row.intelligenceCategory as string | null;
  const urgency = row.intelligenceUrgency as string | null;
  const suspicious = row.intelligenceSuspiciousJson as Record<string, unknown> | null;

  return {
    id: String(row.id),
    mailboxId: row.mailboxId as number | null,
    providerMessageId: row.providerMessageId as string,
    fromAddr: row.fromAddr as string,
    fromName: row.fromName as string | null,
    toAddr: row.toAddr as string | null,
    ccAddr: row.ccAddr as string | null,
    subject: row.subject as string | null,
    snippet: row.snippet as string | null,
    threadId: row.threadId as string | null,
    date: row.date as number,
    direction: row.direction as "sent" | "received" | null,
    isRead: row.isRead as boolean,
    labelIds,
    hasAttachment: labelIds.includes(HAS_ATTACHMENT_LABEL),
    createdAt: row.createdAt as number,
    unsubscribeUrl: row.unsubscribeUrl as string | null,
    unsubscribeEmail: row.unsubscribeEmail as string | null,
    snoozedUntil: row.snoozedUntil as number | null,
    intelligenceStatus: status,
    intelligence:
      status === "ready" && category
        ? {
            category,
            urgency: urgency ?? "low",
            suspicious: suspicious ?? {
              isSuspicious: false,
              kind: null,
              reason: null,
              confidence: null,
            },
          }
        : null,
  };
}

type Operations = {
  getEmails: {
    params: {
      userId: string;
      view?: ViewFilter;
      mailboxId?: number;
      limit?: number;
      offset?: number;
      search?: string;
      isRead?: "true" | "false";
    };
  };
  getEmailDetail: { params: { userId: string; emailId: number } };
  getEmailDetailAI: { params: { userId: string; emailId: number } };
  getEmailThread: { params: { userId: string; threadId: string } };
  getDrafts: { params: { userId: string; mailboxId?: number } };
  getDraftByKey: { params: { userId: string; composeKey: string } };
  upsertDraft: {
    params: {
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
    };
  };
  deleteDraft: { params: { id: number; userId: string } };
  updateEmail: {
    params: {
      userId: string;
      emailId: number;
      patch: EmailPatchMutation;
    };
  };
  updateEmails: {
    params: {
      userId: string;
      emailIds: number[];
      patch: EmailPatchMutation;
    };
  };
  insertEmails: {
    params: {
      rows: Array<typeof schema.emails.$inferInsert>;
    };
  };
  insertEmailIntelligence: {
    params: {
      rows: Array<typeof schema.emailIntelligence.$inferInsert>;
    };
  };
  upsertSubscriptions: {
    params: {
      rows: Array<typeof schema.emailSubscriptions.$inferInsert>;
    };
  };
  getSubscriptions: { params: { userId: string; status?: string } };
  searchEmails: {
    params: {
      userId: string;
      query: string;
      mailboxId?: number;
      view?: ViewFilter;
      limit?: number;
      offset?: number;
      includeJunk?: boolean;
    };
  };
  getContactSuggestions: { params: { userId: string; query: string; limit?: number } };
  getSearchSuggestions: {
    params: { userId: string; query: string; mailboxId?: number; view?: ViewFilter };
  };
  setMeta: { params: { key: string; value: string } };
  getMeta: { params: { key: string } };
  clear: { params: Record<string, never> };
};

type OpName = keyof Operations;

const handlers: {
  [K in OpName]: (params: Operations[K]["params"]) => Promise<unknown>;
} = {
  async getEmails({
    userId,
    view = "inbox",
    mailboxId,
    limit = 100,
    offset = 0,
    search,
    isRead,
  }) {
    const now = Date.now();
    const conditions: unknown[] = [eq(schema.emails.userId, userId)];

    if (mailboxId != null) {
      conditions.push(eq(schema.emails.mailboxId, mailboxId));
    }

    if (isRead === "true") {
      conditions.push(eq(schema.emails.isRead, true));
    } else if (isRead === "false") {
      conditions.push(eq(schema.emails.isRead, false));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(schema.emails.subject, pattern),
          like(schema.emails.snippet, pattern),
          like(schema.emails.fromAddr, pattern),
          like(schema.emails.fromName, pattern),
          like(schema.emails.toAddr, pattern),
          like(schema.emails.bodyText, pattern),
        )!,
      );
    }

    conditions.push(...buildViewConditions(view, now));

    const rowsWithExtra = await db
      .select({ ...emailSummaryColumns, ...intelligenceColumns })
      .from(schema.emails)
      .leftJoin(
        schema.emailIntelligence,
        eq(schema.emailIntelligence.emailId, schema.emails.id),
      )
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

  async getEmailDetail({ userId, emailId }) {
    const rows = await db
      .select({
        ...emailSummaryColumns,
        ...intelligenceColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .leftJoin(
        schema.emailIntelligence,
        eq(schema.emailIntelligence.emailId, schema.emails.id),
      )
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
      attachments: [],
    };
  },

  async getEmailDetailAI({ userId, emailId }) {
    const rows = await db
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
      (action) =>
        typeof action === "object" &&
        action !== null &&
        (action as { type?: unknown }).type === "reply" &&
        (action as { status?: unknown }).status === "pending",
    ) as { payload?: { draft?: unknown } } | undefined;

    const replyDraft =
      typeof replyAction?.payload?.draft === "string"
        ? replyAction.payload.draft
        : null;

    const result: EmailDetailIntelligence = {
      summary: row.summary ?? null,
      suspicious: row.suspiciousJson ?? {
        isSuspicious: false,
        kind: null,
        reason: null,
        confidence: null,
      },
      replyDraft,
    };

    return result;
  },

  async getEmailThread({ userId, threadId }) {
    const rows = await db
      .select({
        ...emailSummaryColumns,
        ...intelligenceColumns,
        bodyText: schema.emails.bodyText,
        bodyHtml: schema.emails.bodyHtml,
      })
      .from(schema.emails)
      .leftJoin(
        schema.emailIntelligence,
        eq(schema.emailIntelligence.emailId, schema.emails.id),
      )
      .where(
        and(eq(schema.emails.userId, userId), eq(schema.emails.threadId, threadId)),
      )
      .orderBy(asc(schema.emails.date));

    return rows.map((row) => ({
      ...toEmailListItem(row),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
    }));
  },

  async getDrafts({ userId, mailboxId }) {
    const conditions = [eq(schema.drafts.userId, userId)];
    if (mailboxId != null) {
      conditions.push(eq(schema.drafts.mailboxId, mailboxId));
    }

    const rows = await db
      .select()
      .from(schema.drafts)
      .where(conditions.length ? and(...(conditions as [])) : undefined)
      .orderBy(desc(schema.drafts.updatedAt));

    return rows.map(({ userId: _, ...row }) => row);
  },

  async getDraftByKey({ userId, composeKey }) {
    const rows = await db
      .select()
      .from(schema.drafts)
      .where(
        and(
          eq(schema.drafts.userId, userId),
          eq(schema.drafts.composeKey, composeKey),
        ),
      )
      .limit(1);

    if (!rows[0]) return null;
    const { userId: _, ...row } = rows[0];
    return row;
  },

  async upsertDraft(params) {
    const now = Date.now();
    const existing = await db
      .select({ id: schema.drafts.id })
      .from(schema.drafts)
      .where(
        and(
          eq(schema.drafts.userId, params.userId),
          eq(schema.drafts.composeKey, params.composeKey),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
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

      const rows = await db
        .select()
        .from(schema.drafts)
        .where(eq(schema.drafts.id, existing[0].id))
        .limit(1);
      const { userId: _, ...row } = rows[0]!;
      return row;
    }

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
        attachmentKeys: params.attachmentKeys ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: schema.drafts.id });

    const rows = await db
      .select()
      .from(schema.drafts)
      .where(eq(schema.drafts.id, inserted[0]!.id))
      .limit(1);
    const { userId: _, ...row } = rows[0]!;
    return row;
  },

  async deleteDraft({ id, userId }) {
    await db
      .delete(schema.drafts)
      .where(and(eq(schema.drafts.id, id), eq(schema.drafts.userId, userId)));
  },

  async updateEmail({ userId, emailId, patch }) {
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

  async updateEmails({ userId, emailIds, patch }) {
    for (const id of emailIds) {
      await handlers.updateEmail({ userId, emailId: id, patch });
    }
  },

  async insertEmails({ rows }) {
    if (!rows.length) return;
    for (const row of rows) {
      await db
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

  async insertEmailIntelligence({ rows }) {
    if (!rows.length) return;
    for (const row of rows) {
      await db
        .insert(schema.emailIntelligence)
        .values(row)
        .onConflictDoUpdate({
          target: schema.emailIntelligence.emailId,
          set: {
            category: row.category,
            urgency: row.urgency,
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

  async upsertSubscriptions({ rows }) {
    if (!rows.length) return;
    for (const row of rows) {
      await db
        .insert(schema.emailSubscriptions)
        .values(row)
        .onConflictDoUpdate({
          target: [
            schema.emailSubscriptions.mailboxId,
            schema.emailSubscriptions.senderKey,
          ],
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

  async getSubscriptions({ userId, status }) {
    const conditions = [eq(schema.emailSubscriptions.userId, userId)];
    if (status) {
      conditions.push(eq(schema.emailSubscriptions.status, status as "active"));
    }

    return db
      .select()
      .from(schema.emailSubscriptions)
      .where(conditions.length ? and(...(conditions as [])) : undefined)
      .orderBy(desc(schema.emailSubscriptions.lastReceivedAt));
  },

  async searchEmails({
    userId,
    query,
    mailboxId,
    view,
    limit = 30,
    offset = 0,
    includeJunk = false,
  }) {
    const pattern = `%${query}%`;
    const baseConditions: unknown[] = [
      eq(schema.emails.userId, userId),
      or(
        like(schema.emails.subject, pattern),
        like(schema.emails.snippet, pattern),
        like(schema.emails.fromAddr, pattern),
        like(schema.emails.fromName, pattern),
        like(schema.emails.toAddr, pattern),
        like(schema.emails.bodyText, pattern),
      )!,
    ];

    if (mailboxId != null) {
      baseConditions.push(eq(schema.emails.mailboxId, mailboxId));
    }

    const conditions = [...baseConditions];
    if (view) {
      conditions.push(...buildViewConditions(view, Date.now()));
    } else if (!includeJunk) {
      conditions.push(sql<boolean>`not ${hasLabel("SPAM")}`);
      conditions.push(sql<boolean>`not ${hasLabel("TRASH")}`);
    }

    const rowsWithExtra = await db
      .select({ ...emailSummaryColumns, ...intelligenceColumns })
      .from(schema.emails)
      .leftJoin(
        schema.emailIntelligence,
        eq(schema.emailIntelligence.emailId, schema.emails.id),
      )
      .where(and(...(conditions as [])))
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
        .where(
          and(
            ...(baseConditions as []),
            or(hasLabel("SPAM"), hasLabel("TRASH"))!,
          ),
        );
      hiddenJunkCount = hiddenRows[0]?.count ?? 0;
    }

    return {
      data: rows.map(toEmailListItem),
      pagination: { limit, offset, hasMore },
      searchMeta: { hiddenJunkCount },
    };
  },

  async getContactSuggestions({ userId, query, limit = 8 }) {
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
          or(
            like(schema.emails.fromAddr, pattern),
            like(schema.emails.fromName, pattern),
          ),
        ),
      )
      .groupBy(schema.emails.fromAddr)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((r) => ({
      email: r.fromAddr,
      name: r.fromName,
      avatarUrl: null,
      lastInteractionAt: r.lastDate,
      interactionCount: r.count,
    }));
  },

  async getSearchSuggestions({ userId, query, mailboxId, view }) {
    const normalized = query.trim();
    const contacts: Array<{
      email: string;
      name: string | null;
      avatarUrl: null;
      lastInteractionAt: number | null;
      interactionCount: number;
    }> = normalized
      ? ((await handlers.getContactSuggestions({
          userId,
          query: normalized,
          limit: 6,
        })) as Array<{
          email: string;
          name: string | null;
          avatarUrl: null;
          lastInteractionAt: number | null;
          interactionCount: number;
        }>)
      : [];

    const conditions: unknown[] = [eq(schema.emails.userId, userId)];
    if (mailboxId != null) {
      conditions.push(eq(schema.emails.mailboxId, mailboxId));
    }
    if (view) {
      conditions.push(...buildViewConditions(view, Date.now()));
    }

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
      filters: [],
      contacts: contacts.map((contact) => ({
        kind: "contact" as const,
        id: `contact:${contact.email}`,
        label: contact.name ?? contact.email,
        query: `from:${contact.email}`,
        description: contact.email,
        ...contact,
      })),
      subjects: subjectRows
        .filter((row) => row.subject)
        .map((row) => ({
          kind: "subject" as const,
          id: `subject:${row.subject}`,
          label: row.subject!,
          query: `subject:\"${row.subject!}\"`,
          subject: row.subject!,
          description: null,
          lastUsedAt: row.lastUsedAt ?? null,
        })),
    };
  },

  async setMeta({ key, value }) {
    await execute(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)`,
      [key, value],
      "run",
    );
  },

  async getMeta({ key }) {
    const result = await execute(
      `SELECT value FROM _meta WHERE key = ?`,
      [key],
      "all",
    );
    const rows = result.rows as Array<{ value: string }>;
    return rows[0]?.value ?? null;
  },

  async clear() {
    await execute("DELETE FROM email_intelligence", [], "run");
    await execute("DELETE FROM email_subscriptions", [], "run");
    await execute("DELETE FROM drafts", [], "run");
    await execute("DELETE FROM emails", [], "run");
    await execute("DELETE FROM _meta", [], "run");
  },
};

async function handleMessage(op: string, params: unknown) {
  const handler = handlers[op as OpName];
  if (!handler) {
    throw new Error(`Unknown operation: ${op}`);
  }
  return handler(params as never);
}

async function init() {
  try {
    await initDatabase();
    self.postMessage({ type: "ready" });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : "Failed to initialize database",
    });
  }
}

let opQueue: Promise<void> = Promise.resolve();

self.onmessage = async (e: MessageEvent<{ id: number; op: string; params: unknown }>) => {
  const { id, op, params } = e.data;
  opQueue = opQueue.then(async () => {
    try {
      const result = await handleMessage(op, params);
      self.postMessage({ id, result });
    } catch (err) {
      self.postMessage({
        id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
};

init();
