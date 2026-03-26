import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { account, user } from "./auth-schema";

export const dailyBriefings = sqliteTable(
  "daily_briefings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    narrative: text("narrative"),
    unreadCount: integer("unread_count"),
    followUpCount: integer("follow_up_count"),
    tasksDueCount: integer("tasks_due_count"),
    overdueCount: integer("overdue_count"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("daily_briefings_user_date_idx").on(table.userId, table.date),
  ],
);

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
    aiLabel: text("ai_label").$type<
      | "action_needed"
      | "important"
      | "later"
      | "newsletter"
      | "marketing"
      | "transactional"
      | "notification"
    >(),
    unsubscribeUrl: text("unsubscribe_url"),
    unsubscribeEmail: text("unsubscribe_email"),
    snoozedUntil: integer("snoozed_until"),
    draftReply: text("draft_reply"),
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

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: integer("due_at"),
    dueTime: text("due_time"),
    priority: text("priority")
      .$type<"urgent" | "high" | "medium" | "low">()
      .notNull()
      .default("low"),
    status: text("status")
      .$type<TaskStatus>()
      .notNull()
      .default("todo"),
    completedAt: integer("completed_at"),
    position: integer("position").notNull().default(0),
    labels: text("labels", { mode: "json" }).$type<string[]>().notNull().default([]),
    recurrence: text("recurrence", { mode: "json" }).$type<RecurrenceRule | null>(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("tasks_user_status_idx").on(table.userId, table.status),
    index("tasks_user_due_idx").on(table.userId, table.dueAt),
  ],
);

export type RecurrenceRule = {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  endAt?: number;
};


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
  field: "from" | "to" | "subject" | "aiLabel";
  operator: "contains" | "equals" | "startsWith" | "endsWith";
  value: string;
};

export type FilterActions = {
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  applyAiLabel?:
    | "action_needed"
    | "important"
    | "later"
    | "newsletter"
    | "marketing"
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

export const proposedEvents = sqliteTable(
  "proposed_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mailboxId: integer("mailbox_id").references(() => mailboxes.id, {
      onDelete: "cascade",
    }),
    emailId: integer("email_id"),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startAt: integer("start_at").notNull(),
    endAt: integer("end_at").notNull(),
    attendees: text("attendees", { mode: "json" }).$type<string[]>(),
    status: text("status")
      .$type<"pending" | "approved" | "dismissed">()
      .notNull()
      .default("pending"),
    googleEventId: text("google_event_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("proposed_events_user_status_idx").on(table.userId, table.status),
  ],
);
