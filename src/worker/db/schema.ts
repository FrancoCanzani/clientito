import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { account, user } from "./auth-schema";

export const mailboxes = sqliteTable(
  "mailboxes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => account.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").$type<"google" | "outlook">().notNull().default("google"),
    email: text("email"),
    signature: text("signature"),
    historyId: text("history_id"),
    syncWindowMonths: integer("sync_window_months"),
    syncCutoffAt: integer("sync_cutoff_at"),
    authState: text("auth_state")
      .$type<"unknown" | "ok" | "reconnect_required">()
      .notNull()
      .default("unknown"),
    lastSuccessfulSyncAt: integer("last_successful_sync_at"),
    lastErrorAt: integer("last_error_at"),
    lastErrorMessage: text("last_error_message"),
    lockUntil: integer("lock_until"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("mailboxes_user_idx").on(table.userId),
    uniqueIndex("mailboxes_account_idx").on(table.accountId),
    index("mailboxes_auth_state_idx").on(table.authState),
    index("mailboxes_last_success_idx").on(table.lastSuccessfulSyncAt),
  ],
);

export const syncJobs = sqliteTable(
  "sync_jobs",
  {
    id: text("id").primaryKey(),
    mailboxId: integer("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"full" | "incremental">().notNull(),
    trigger: text("trigger")
      .$type<"manual" | "scheduled" | "system">()
      .notNull(),
    status: text("status")
      .$type<"running" | "succeeded" | "failed">()
      .notNull(),
    phase: text("phase"),
    progressCurrent: integer("progress_current"),
    progressTotal: integer("progress_total"),
    attempt: integer("attempt").notNull().default(1),
    errorClass: text("error_class"),
    errorMessage: text("error_message"),
    runAfterAt: integer("run_after_at"),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("sync_jobs_mailbox_created_idx").on(table.mailboxId, table.createdAt),
    index("sync_jobs_mailbox_status_idx").on(table.mailboxId, table.status),
  ],
);

export const scheduledEmails = sqliteTable(
  "scheduled_emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    to: text("to").notNull(),
    cc: text("cc"),
    bcc: text("bcc"),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    inReplyTo: text("in_reply_to"),
    references: text("references"),
    threadId: text("thread_id"),
    attachmentKeys: text("attachment_keys", { mode: "json" }).$type<
      Array<{ key: string; filename: string; mimeType: string }>
    >(),
    scheduledFor: integer("scheduled_for").notNull(),
    status: text("status")
      .$type<"pending" | "sent" | "failed" | "cancelled">()
      .notNull()
      .default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
    error: text("error"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("scheduled_emails_pending_idx").on(table.status, table.scheduledFor),
    index("scheduled_emails_user_idx").on(table.userId, table.status),
  ],
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    composeKey: text("compose_key").notNull(),
    mailboxId: integer("mailbox_id"),
    toAddr: text("to_addr").notNull().default(""),
    ccAddr: text("cc_addr").notNull().default(""),
    bccAddr: text("bcc_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    forwardedContent: text("forwarded_content").notNull().default(""),
    threadId: text("thread_id"),
    attachmentKeys: text("attachment_keys", { mode: "json" }).$type<
      Array<{ key: string; filename: string; mimeType: string }>
    >(),
    updatedAt: integer("updated_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("drafts_user_compose_key_idx").on(table.userId, table.composeKey),
    index("drafts_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);


