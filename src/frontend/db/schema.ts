import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const emails = pgTable(
  "emails",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    mailboxId: integer("mailbox_id"),
    providerMessageId: text("provider_message_id").notNull().unique(),
    threadId: text("thread_id"),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    toAddr: text("to_addr"),
    ccAddr: text("cc_addr"),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    date: bigint("date", { mode: "number" }).notNull(),
    direction: text("direction").$type<"sent" | "received">(),
    isRead: boolean("is_read").notNull().default(false),
    labelIds: jsonb("label_ids").$type<string[] | null>(),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    snoozedUntil: bigint("snoozed_until", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("emails_date_idx").on(table.date),
    index("emails_thread_idx").on(table.threadId),
    index("emails_snoozed_idx").on(table.snoozedUntil),
    index("emails_mailbox_date_idx").on(table.mailboxId, table.date),
  ],
);

export const emailIntelligence = pgTable(
  "email_intelligence",
  {
    id: serial("id").primaryKey(),
    emailId: integer("email_id").notNull(),
    userId: text("user_id").notNull(),
    mailboxId: integer("mailbox_id"),
    category: text("category").$type<
      "to_respond" | "to_follow_up" | "fyi" | "notification" | "invoice" | "marketing"
    >(),
    summary: text("summary"),
    suspiciousJson: jsonb("suspicious_json")
      .$type<{
        isSuspicious: boolean;
      }>()
      .notNull()
      .default({
        isSuspicious: false,
      }),
    actionsJson: jsonb("actions_json").$type<unknown[]>().notNull().default([]),
    status: text("status")
      .$type<"pending" | "ready" | "error">()
      .notNull()
      .default("pending"),
    sourceHash: text("source_hash"),
    model: text("model"),
    schemaVersion: integer("schema_version").notNull().default(1),
    attemptCount: integer("attempt_count").notNull().default(0),
    error: text("error"),
    lastProcessedAt: bigint("last_processed_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("email_intelligence_email_idx").on(table.emailId),
    index("email_intelligence_status_idx").on(table.status),
  ],
);

export const emailSubscriptions = pgTable(
  "email_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    mailboxId: integer("mailbox_id"),
    senderKey: text("sender_key").notNull(),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    status: text("status")
      .$type<"active" | "pending_manual" | "unsubscribed">()
      .notNull()
      .default("active"),
    emailCount: integer("email_count").notNull().default(0),
    lastReceivedAt: bigint("last_received_at", { mode: "number" }),
    unsubscribeMethod: text("unsubscribe_method").$type<"one-click" | "mailto" | "manual" | null>(),
    unsubscribeRequestedAt: bigint("unsubscribe_requested_at", { mode: "number" }),
    unsubscribedAt: bigint("unsubscribed_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("email_subscriptions_mailbox_sender_idx").on(
      table.mailboxId,
      table.senderKey,
    ),
    index("email_subscriptions_status_idx").on(table.status),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    composeKey: text("compose_key").notNull(),
    mailboxId: integer("mailbox_id"),
    toAddr: text("to_addr").notNull().default(""),
    ccAddr: text("cc_addr").notNull().default(""),
    bccAddr: text("bcc_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    forwardedContent: text("forwarded_content").notNull().default(""),
    threadId: text("thread_id"),
    attachmentKeys: jsonb("attachment_keys").$type<
      Array<{ key: string; filename: string; mimeType: string }> | null
    >(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("drafts_compose_key_idx").on(table.userId, table.composeKey),
    index("drafts_updated_idx").on(table.updatedAt),
  ],
);
