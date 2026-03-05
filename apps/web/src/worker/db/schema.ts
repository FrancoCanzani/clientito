import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    name: text("name"),
    industry: text("industry"),
    website: text("website"),
    description: text("description"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("companies_user_domain_idx").on(table.userId, table.domain),
  ],
);

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    title: text("title"),
    linkedin: text("linkedin"),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    lastContactedAt: integer("last_contacted_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("people_user_email_idx").on(table.userId, table.email),
    index("people_company_idx").on(table.companyId),
  ],
);

export const peopleAiContext = sqliteTable("people_ai_context", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  briefing: text("briefing"),
  suggestedActions: text("suggested_actions"),
  generatedAt: integer("generated_at").notNull(),
});

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
    personId: integer("person_id").references(() => people.id, {
      onDelete: "cascade",
    }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default("Untitled note"),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull().default(0),
  },
  (table) => [
    index("notes_person_idx").on(table.personId),
    index("notes_company_idx").on(table.companyId),
    index("notes_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gmailId: text("gmail_id").notNull().unique(),
    threadId: text("thread_id"),
    messageId: text("message_id"),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    toAddr: text("to_addr"),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    date: integer("date").notNull(),
    direction: text("direction").$type<"sent" | "received">(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    labelIds: text("label_ids", { mode: "json" }).$type<string[] | null>(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("emails_user_idx").on(table.userId),
    index("emails_person_idx").on(table.personId),
    index("emails_user_date_idx").on(table.userId, table.date),
    index("emails_thread_idx").on(table.threadId),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    dueAt: integer("due_at"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("tasks_person_idx").on(table.personId),
    index("tasks_user_done_idx").on(table.userId, table.done),
  ],
);

export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  historyId: text("history_id"),
  lastSync: integer("last_sync"),
  lockUntil: integer("lock_until"),
  phase: text("phase"),
  progressCurrent: integer("progress_current"),
  progressTotal: integer("progress_total"),
  error: text("error"),
});
