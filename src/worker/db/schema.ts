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
    templates: text("templates"),
    historyId: text("history_id"),
    syncWindowMonths: integer("sync_window_months"),
    syncCutoffAt: integer("sync_cutoff_at"),
    aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(true),
    authState: text("auth_state")
      .$type<"unknown" | "ok" | "reconnect_required">()
      .notNull()
      .default("unknown"),
    lastSuccessfulSyncAt: integer("last_successful_sync_at"),
    lastErrorAt: integer("last_error_at"),
    lastErrorMessage: text("last_error_message"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("mailboxes_user_idx").on(table.userId),
    uniqueIndex("mailboxes_account_idx").on(table.accountId),
    index("mailboxes_auth_state_idx").on(table.authState),
    index("mailboxes_last_success_idx").on(table.lastSuccessfulSyncAt),
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

export type TrustEntityType = "sender" | "domain";
export type TrustLevel = "trusted" | "blocked";

export const trustEntities = sqliteTable(
  "trust_entities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    entityType: text("entity_type").$type<TrustEntityType>().notNull(),
    entityValue: text("entity_value").notNull(),
    trustLevel: text("trust_level").$type<TrustLevel>().notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("trust_entities_unique_entity_idx").on(
      table.userId,
      table.mailboxId,
      table.entityType,
      table.entityValue,
    ),
    index("trust_entities_user_mailbox_idx").on(table.userId, table.mailboxId),
    index("trust_entities_level_idx").on(table.trustLevel),
  ],
);

export type SplitRule = {
  domains?: string[];
  senders?: string[];
  recipients?: string[];
  subjectContains?: string[];
  hasAttachment?: boolean | null;
  fromMailingList?: boolean | null;
  gmailLabels?: string[];
};

export const splitViews = sqliteTable(
  "split_views",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon"),
    color: text("color"),
    position: integer("position").notNull().default(0),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    systemKey: text("system_key"),
    rules: text("rules", { mode: "json" }).$type<SplitRule>(),
    matchMode: text("match_mode")
      .$type<"rules">()
      .notNull()
      .default("rules"),
    showInOther: integer("show_in_other", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("split_views_user_idx").on(table.userId, table.position),
    uniqueIndex("split_views_user_system_idx").on(table.userId, table.systemKey),
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
