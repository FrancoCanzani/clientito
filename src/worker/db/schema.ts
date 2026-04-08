import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { account, user } from "./auth-schema";

export type EmailIntelligenceCategory =
  | "important"
  | "action_needed"
  | "newsletter"
  | "notification"
  | "transactional";

export type EmailIntelligenceUrgency = "high" | "medium" | "low";

export type EmailActionType = "reply";

export type EmailActionTrustLevel = "auto" | "approve";

export type EmailActionStatus =
  | "pending"
  | "executed"
  | "dismissed"
  | "failed";

export type EmailSuspiciousKind =
  | "phishing"
  | "impersonation"
  | "credential_harvest"
  | "payment_fraud";

export type EmailSuspiciousConfidence = "low" | "medium" | "high";

export type EmailAction = {
  id: string;
  type: EmailActionType;
  label: string;
  payload: Record<string, unknown>;
  trustLevel: EmailActionTrustLevel;
  status: EmailActionStatus;
  error: string | null;
  executedAt: number | null;
  updatedAt: number;
};

export type EmailSuspiciousFlag = {
  isSuspicious: boolean;
  kind: EmailSuspiciousKind | null;
  reason: string | null;
  confidence: EmailSuspiciousConfidence | null;
};

export type EmailIntelligenceStatus = "pending" | "ready" | "error";

export type PersistedEmailIntelligence = {
  category: EmailIntelligenceCategory;
  urgency: EmailIntelligenceUrgency;
  summary: string;
  suspicious: EmailSuspiciousFlag;
  actions: EmailAction[];
  autoExecute: string[];
  requiresApproval: string[];
};


export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled note"),
    content: text("content").notNull(),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull().default(0),
  },
  (table) => [index("notes_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id").references(() => mailboxes.id, {
      onDelete: "cascade",
    }),
    providerMessageId: text("provider_message_id").notNull().unique(),
    threadId: text("thread_id"),
    messageId: text("message_id"),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    toAddr: text("to_addr"),
    ccAddr: text("cc_addr"),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    date: integer("date").notNull(),
    direction: text("direction").$type<"sent" | "received">(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    labelIds: text("label_ids", { mode: "json" }).$type<string[] | null>(),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    snoozedUntil: integer("snoozed_until"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("emails_user_idx").on(table.userId),
    index("emails_user_date_idx").on(table.userId, table.date),
    index("emails_thread_idx").on(table.threadId),
    index("emails_user_snoozed_idx").on(table.userId, table.snoozedUntil),
    index("emails_mailbox_date_idx").on(table.mailboxId, table.date),
  ],
);

export type EmailSubscriptionStatus =
  | "active"
  | "pending_manual"
  | "unsubscribed";

export type EmailSubscriptionMethod = "one-click" | "mailto" | "manual";

export const emailSubscriptions = sqliteTable(
  "email_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id").references(() => mailboxes.id, {
      onDelete: "cascade",
    }),
    senderKey: text("sender_key").notNull(),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    status: text("status")
      .$type<EmailSubscriptionStatus>()
      .notNull()
      .default("active"),
    emailCount: integer("email_count").notNull().default(0),
    lastReceivedAt: integer("last_received_at"),
    unsubscribeMethod: text("unsubscribe_method").$type<EmailSubscriptionMethod | null>(),
    unsubscribeRequestedAt: integer("unsubscribe_requested_at"),
    unsubscribedAt: integer("unsubscribed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("email_subscriptions_mailbox_sender_idx").on(
      table.mailboxId,
      table.senderKey,
    ),
    index("email_subscriptions_user_status_idx").on(table.userId, table.status),
    index("email_subscriptions_user_updated_idx").on(table.userId, table.updatedAt),
    index("email_subscriptions_user_last_received_idx").on(
      table.userId,
      table.lastReceivedAt,
    ),
  ],
);

export const emailIntelligence = sqliteTable(
  "email_intelligence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    emailId: integer("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id").references(() => mailboxes.id, {
      onDelete: "cascade",
    }),
    category: text("category").$type<EmailIntelligenceCategory>(),
    urgency: text("urgency").$type<EmailIntelligenceUrgency>(),
    summary: text("summary"),
    suspiciousJson: text("suspicious_json", { mode: "json" })
      .$type<EmailSuspiciousFlag>()
      .notNull()
      .default({
        isSuspicious: false,
        kind: null,
        reason: null,
        confidence: null,
      }),
    actionsJson: text("actions_json", { mode: "json" })
      .$type<EmailAction[]>()
      .notNull()
      .default([]),
    status: text("status")
      .$type<EmailIntelligenceStatus>()
      .notNull()
      .default("pending"),
    sourceHash: text("source_hash"),
    model: text("model"),
    schemaVersion: integer("schema_version").notNull().default(1),
    attemptCount: integer("attempt_count").notNull().default(0),
    error: text("error"),
    lastProcessedAt: integer("last_processed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("email_intelligence_email_idx").on(table.emailId),
    index("email_intelligence_user_status_idx").on(table.userId, table.status),
    index("email_intelligence_user_updated_idx").on(table.userId, table.updatedAt),
    index("email_intelligence_mailbox_idx").on(table.mailboxId),
  ],
);

export const emailFilters = sqliteTable(
  "email_filters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    conditions: text("conditions", { mode: "json" })
      .$type<FilterCondition[]>()
      .notNull()
      .default([]),
    actions: text("actions", { mode: "json" }).$type<FilterActions>().notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("email_filters_user_idx").on(table.userId),
    index("email_filters_user_priority_idx").on(table.userId, table.priority),
  ],
);

export type FilterCondition = {
  field: "from" | "to" | "subject" | "category";
  operator: "contains" | "equals" | "startsWith" | "endsWith";
  value: string;
};

export type FilterActions = {
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  applyCategory?:
    | "action_needed"
    | "important"
    | "newsletter"
    | "transactional"
    | "notification";
  trash?: boolean;
};

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
