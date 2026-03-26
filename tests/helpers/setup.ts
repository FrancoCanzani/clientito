import { env } from "cloudflare:workers";
import { createDb, type Database } from "../../src/worker/db/client";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS \`user\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`email\` text NOT NULL,
  \`email_verified\` integer DEFAULT false NOT NULL,
  \`image\` text,
  \`created_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  \`updated_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`user_email_unique\` ON \`user\` (\`email\`);

CREATE TABLE IF NOT EXISTS \`account\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`account_id\` text NOT NULL,
  \`provider_id\` text NOT NULL,
  \`user_id\` text NOT NULL,
  \`access_token\` text,
  \`refresh_token\` text,
  \`id_token\` text,
  \`access_token_expires_at\` integer,
  \`refresh_token_expires_at\` integer,
  \`scope\` text,
  \`password\` text,
  \`created_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  \`updated_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`account_user_id_idx\` ON \`account\` (\`user_id\`);

CREATE TABLE IF NOT EXISTS \`session\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`expires_at\` integer NOT NULL,
  \`token\` text NOT NULL,
  \`created_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  \`updated_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  \`ip_address\` text,
  \`user_agent\` text,
  \`user_id\` text NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS \`session_token_unique\` ON \`session\` (\`token\`);
CREATE INDEX IF NOT EXISTS \`session_user_id_idx\` ON \`session\` (\`user_id\`);

CREATE TABLE IF NOT EXISTS \`verification\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`identifier\` text NOT NULL,
  \`value\` text NOT NULL,
  \`expires_at\` integer NOT NULL,
  \`created_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  \`updated_at\` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE TABLE IF NOT EXISTS \`mailboxes\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`account_id\` text,
  \`provider\` text DEFAULT 'google' NOT NULL,
  \`email\` text,
  \`signature\` text,
  \`history_id\` text,
  \`sync_window_months\` integer,
  \`sync_cutoff_at\` integer,
  \`auth_state\` text DEFAULT 'unknown' NOT NULL,
  \`last_successful_sync_at\` integer,
  \`last_error_at\` integer,
  \`last_error_message\` text,
  \`lock_until\` integer,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`account_id\`) REFERENCES \`account\`(\`id\`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`mailboxes_user_idx\` ON \`mailboxes\` (\`user_id\`);
CREATE UNIQUE INDEX IF NOT EXISTS \`mailboxes_account_idx\` ON \`mailboxes\` (\`account_id\`);

CREATE TABLE IF NOT EXISTS \`emails\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`mailbox_id\` integer,
  \`provider_message_id\` text NOT NULL,
  \`thread_id\` text,
  \`message_id\` text,
  \`from_addr\` text NOT NULL,
  \`from_name\` text,
  \`to_addr\` text,
  \`cc_addr\` text,
  \`subject\` text,
  \`snippet\` text,
  \`body_text\` text,
  \`body_html\` text,
  \`date\` integer NOT NULL,
  \`direction\` text,
  \`is_read\` integer DEFAULT false NOT NULL,
  \`label_ids\` text,
  \`ai_label\` text,
  \`unsubscribe_url\` text,
  \`unsubscribe_email\` text,
  \`snoozed_until\` integer,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`mailbox_id\`) REFERENCES \`mailboxes\`(\`id\`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS \`emails_provider_message_id_unique\` ON \`emails\` (\`provider_message_id\`);
CREATE INDEX IF NOT EXISTS \`emails_user_idx\` ON \`emails\` (\`user_id\`);
CREATE INDEX IF NOT EXISTS \`emails_user_date_idx\` ON \`emails\` (\`user_id\`,\`date\`);
CREATE INDEX IF NOT EXISTS \`emails_thread_idx\` ON \`emails\` (\`thread_id\`);
CREATE INDEX IF NOT EXISTS \`emails_mailbox_date_idx\` ON \`emails\` (\`mailbox_id\`,\`date\`);

CREATE TABLE IF NOT EXISTS \`tasks\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text,
  \`due_at\` integer,
  \`due_time\` text,
  \`priority\` text DEFAULT 'low' NOT NULL,
  \`status\` text DEFAULT 'todo' NOT NULL,
  \`completed_at\` integer,
  \`position\` integer DEFAULT 0 NOT NULL,
  \`labels\` text DEFAULT '[]' NOT NULL,
  \`recurrence\` text,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`tasks_user_status_idx\` ON \`tasks\` (\`user_id\`,\`status\`);
CREATE INDEX IF NOT EXISTS \`tasks_user_due_idx\` ON \`tasks\` (\`user_id\`,\`due_at\`);

CREATE TABLE IF NOT EXISTS \`notes\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`title\` text DEFAULT 'Untitled note' NOT NULL,
  \`content\` text NOT NULL,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`email_filters\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`conditions\` text DEFAULT '[]' NOT NULL,
  \`actions\` text NOT NULL,
  \`enabled\` integer DEFAULT true NOT NULL,
  \`priority\` integer DEFAULT 0 NOT NULL,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`email_subscriptions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`mailbox_id\` integer,
  \`sender_key\` text NOT NULL,
  \`from_addr\` text NOT NULL,
  \`from_name\` text,
  \`unsubscribe_url\` text,
  \`unsubscribe_email\` text,
  \`status\` text DEFAULT 'active' NOT NULL,
  \`email_count\` integer DEFAULT 0 NOT NULL,
  \`last_received_at\` integer,
  \`unsubscribe_method\` text,
  \`unsubscribe_requested_at\` integer,
  \`unsubscribed_at\` integer,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`mailbox_id\`) REFERENCES \`mailboxes\`(\`id\`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS \`email_subscriptions_mailbox_sender_idx\` ON \`email_subscriptions\` (\`mailbox_id\`,\`sender_key\`);

CREATE TABLE IF NOT EXISTS \`sync_jobs\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`mailbox_id\` integer NOT NULL,
  \`kind\` text NOT NULL,
  \`trigger\` text NOT NULL,
  \`status\` text NOT NULL,
  \`phase\` text,
  \`progress_current\` integer,
  \`progress_total\` integer,
  \`attempt\` integer DEFAULT 1 NOT NULL,
  \`error_class\` text,
  \`error_message\` text,
  \`run_after_at\` integer,
  \`started_at\` integer,
  \`finished_at\` integer,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`mailbox_id\`) REFERENCES \`mailboxes\`(\`id\`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`daily_briefings\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`date\` text NOT NULL,
  \`narrative\` text,
  \`unread_count\` integer,
  \`follow_up_count\` integer,
  \`tasks_due_count\` integer,
  \`overdue_count\` integer,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS \`scheduled_emails\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`mailbox_id\` integer NOT NULL,
  \`to\` text NOT NULL,
  \`cc\` text,
  \`bcc\` text,
  \`subject\` text DEFAULT '' NOT NULL,
  \`body\` text NOT NULL,
  \`in_reply_to\` text,
  \`references\` text,
  \`thread_id\` text,
  \`attachment_keys\` text,
  \`scheduled_for\` integer NOT NULL,
  \`status\` text DEFAULT 'pending' NOT NULL,
  \`retry_count\` integer DEFAULT 0 NOT NULL,
  \`error\` text,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`mailbox_id\`) REFERENCES \`mailboxes\`(\`id\`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`scheduled_emails_pending_idx\` ON \`scheduled_emails\` (\`status\`,\`scheduled_for\`);
CREATE INDEX IF NOT EXISTS \`scheduled_emails_user_idx\` ON \`scheduled_emails\` (\`user_id\`,\`status\`);

CREATE TABLE IF NOT EXISTS \`proposed_events\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`user_id\` text NOT NULL,
  \`mailbox_id\` integer,
  \`email_id\` integer,
  \`title\` text NOT NULL,
  \`description\` text,
  \`location\` text,
  \`start_at\` integer NOT NULL,
  \`end_at\` integer NOT NULL,
  \`attendees\` text,
  \`google_event_id\` text,
  \`status\` text DEFAULT 'pending' NOT NULL,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`mailbox_id\`) REFERENCES \`mailboxes\`(\`id\`) ON DELETE cascade
);
`;

export const TEST_USER = {
  id: "test-user-1",
  name: "Test User",
  email: "test@example.com",
} as const;

export const TEST_USER_2 = {
  id: "test-user-2",
  name: "Other User",
  email: "other@example.com",
} as const;

export function getDb(): Database {
  return createDb(env.DB);
}

async function migrateDb(): Promise<void> {
  const statements = MIGRATION_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
}

export async function seedTestUser(
  user = TEST_USER,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(user.id, user.name, user.email, now, now)
    .run();
}

async function cleanDb(): Promise<void> {
  const tables = [
    "proposed_events",
    "scheduled_emails",
    "sync_jobs",
    "daily_briefings",
    "email_subscriptions",
    "email_filters",
    "emails",
    "mailboxes",
    "notes",
    "tasks",
    "session",
    "account",
    "verification",
    "user",
  ];
  for (const table of tables) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
}

export async function setupTestDb(): Promise<Database> {
  await migrateDb();
  await cleanDb();
  await seedTestUser();
  return getDb();
}
