import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const organizations = sqliteTable(
  "organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  }
);

export const orgMembers = sqliteTable(
  "org_members",
  {
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })]
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email").notNull(),
    phone: text("phone"),
    website: text("website"),
    vatEin: text("vat_ein"),
    address: text("address"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("customers_org_idx").on(table.orgId),
    uniqueIndex("customers_org_email_unique").on(table.orgId, table.email),
  ],
);

export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    gmailId: text("gmail_id").notNull().unique(),
    threadId: text("thread_id"),
    customerId: integer("customer_id")
      .references(() => customers.id, { onDelete: "set null" })
      .$type<string>(),
    fromAddr: text("from_addr").notNull(),
    fromName: text("from_name"),
    toAddr: text("to_addr"),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    date: integer("date").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    labelIds: text("label_ids", { mode: "json" }).$type<string[] | null>(),
    isCustomer: integer("is_customer", { mode: "boolean" }).notNull().default(false),
    classified: integer("classified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("emails_org_idx").on(table.orgId),
    index("emails_customer_idx").on(table.customerId),
    index("emails_org_date_idx").on(table.orgId, table.date),
  ],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" })
      .$type<string>(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    dueAt: integer("due_at").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("reminders_customer_idx").on(table.customerId),
    index("reminders_org_done_idx").on(table.orgId, table.done),
  ],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    email: text("email").notNull(),
    name: text("name"),
    domain: text("domain").notNull(),
    emailCount: integer("email_count").notNull().default(1),
    latestEmailDate: integer("latest_email_date"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("contacts_org_email_unique").on(table.orgId, table.email),
    index("contacts_org_domain_idx").on(table.orgId, table.domain),
  ],
);

export const customerSummaries = sqliteTable(
  "customer_summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" })
      .$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    summary: text("summary").notNull(),
    generatedAt: integer("generated_at").notNull(),
    triggerReason: text("trigger_reason"),
  },
  (table) => [
    index("customer_summaries_customer_idx").on(table.customerId),
    index("customer_summaries_org_generated_idx").on(
      table.orgId,
      table.generatedAt,
    ),
  ],
);

export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
  orgId: integer("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .$type<string>()
    .unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  historyId: text("history_id"),
  lastSync: integer("last_sync"),
  lockUntil: integer("lock_until"),
  phase: text("phase"),
  progressCurrent: integer("progress_current"),
  progressTotal: integer("progress_total"),
  error: text("error"),
});
