import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    date: integer("date").notNull(),
    direction: text("direction").$type<"sent" | "received">(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    labelIds: text("label_ids"),
    hasInbox: integer("has_inbox", { mode: "boolean" }).notNull().default(false),
    hasSent: integer("has_sent", { mode: "boolean" }).notNull().default(false),
    hasTrash: integer("has_trash", { mode: "boolean" }).notNull().default(false),
    hasSpam: integer("has_spam", { mode: "boolean" }).notNull().default(false),
    hasStarred: integer("has_starred", { mode: "boolean" }).notNull().default(false),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    snoozedUntil: integer("snoozed_until"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("emails_user_mailbox_date_idx").on(table.userId, table.mailboxId, table.date),
    index("emails_thread_idx").on(table.threadId),
    index("emails_snoozed_idx").on(table.snoozedUntil),
  ],
);

export const emailSubscriptions = sqliteTable(
  "email_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    lastReceivedAt: integer("last_received_at"),
    unsubscribeMethod: text("unsubscribe_method").$type<"one-click" | "mailto" | "manual" | null>(),
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
    index("email_subscriptions_status_idx").on(table.status),
  ],
);

export const labels = sqliteTable(
  "labels",
  {
    gmailId: text("gmail_id").notNull().primaryKey(),
    userId: text("user_id").notNull(),
    mailboxId: integer("mailbox_id").notNull(),
    name: text("name").notNull(),
    type: text("type").$type<"system" | "user">().notNull().default("user"),
    textColor: text("text_color"),
    backgroundColor: text("background_color"),
    messagesTotal: integer("messages_total").notNull().default(0),
    messagesUnread: integer("messages_unread").notNull().default(0),
    syncedAt: integer("synced_at").notNull(),
  },
  (table) => [
    index("labels_user_mailbox_idx").on(table.userId, table.mailboxId),
  ],
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    attachmentKeys: text("attachment_keys"),
    updatedAt: integer("updated_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("drafts_compose_key_idx").on(table.userId, table.composeKey),
    index("drafts_updated_idx").on(table.updatedAt),
  ],
);
