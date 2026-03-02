-- Drop old org-based tables
DROP TABLE IF EXISTS `org_members`;
--> statement-breakpoint
DROP TABLE IF EXISTS `organizations`;
--> statement-breakpoint

-- Create new tables
CREATE TABLE `companies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `domain` text NOT NULL,
  `name` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_user_domain_idx` ON `companies` (`user_id`, `domain`);
--> statement-breakpoint

CREATE TABLE `people` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `email` text NOT NULL,
  `name` text,
  `company_id` integer REFERENCES `companies`(`id`) ON DELETE set null,
  `last_contacted_at` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_user_email_idx` ON `people` (`user_id`, `email`);
--> statement-breakpoint
CREATE INDEX `people_company_idx` ON `people` (`company_id`);
--> statement-breakpoint

CREATE TABLE `people_ai_context` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `person_id` integer NOT NULL REFERENCES `people`(`id`) ON DELETE cascade,
  `briefing` text,
  `suggested_actions` text,
  `generated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `daily_briefings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `date` text NOT NULL,
  `narrative` text,
  `unread_count` integer,
  `follow_up_count` integer,
  `tasks_due_count` integer,
  `overdue_count` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_briefings_user_date_idx` ON `daily_briefings` (`user_id`, `date`);
--> statement-breakpoint

CREATE TABLE `notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `person_id` integer REFERENCES `people`(`id`) ON DELETE cascade,
  `company_id` integer REFERENCES `companies`(`id`) ON DELETE cascade,
  `content` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_person_idx` ON `notes` (`person_id`);
--> statement-breakpoint
CREATE INDEX `notes_company_idx` ON `notes` (`company_id`);
--> statement-breakpoint

-- Recreate emails table (SQLite can't ALTER columns, so drop and recreate)
DROP TABLE IF EXISTS `emails`;
--> statement-breakpoint
CREATE TABLE `emails` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `gmail_id` text NOT NULL,
  `thread_id` text,
  `message_id` text,
  `person_id` integer REFERENCES `people`(`id`) ON DELETE set null,
  `from_addr` text NOT NULL,
  `from_name` text,
  `to_addr` text,
  `subject` text,
  `snippet` text,
  `body_text` text,
  `body_html` text,
  `date` integer NOT NULL,
  `direction` text,
  `is_read` integer NOT NULL DEFAULT false,
  `label_ids` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_gmail_id_unique` ON `emails` (`gmail_id`);
--> statement-breakpoint
CREATE INDEX `emails_user_idx` ON `emails` (`user_id`);
--> statement-breakpoint
CREATE INDEX `emails_person_idx` ON `emails` (`person_id`);
--> statement-breakpoint
CREATE INDEX `emails_user_date_idx` ON `emails` (`user_id`, `date`);
--> statement-breakpoint
CREATE INDEX `emails_thread_idx` ON `emails` (`thread_id`);
--> statement-breakpoint

-- Recreate tasks table (was "reminders")
DROP TABLE IF EXISTS `reminders`;
--> statement-breakpoint
CREATE TABLE `tasks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `person_id` integer REFERENCES `people`(`id`) ON DELETE set null,
  `company_id` integer REFERENCES `companies`(`id`) ON DELETE set null,
  `title` text NOT NULL,
  `due_at` integer,
  `done` integer NOT NULL DEFAULT false,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_person_idx` ON `tasks` (`person_id`);
--> statement-breakpoint
CREATE INDEX `tasks_user_done_idx` ON `tasks` (`user_id`, `done`);
--> statement-breakpoint

-- Recreate sync_state table
DROP TABLE IF EXISTS `sync_state`;
--> statement-breakpoint
CREATE TABLE `sync_state` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
  `history_id` text,
  `last_sync` integer,
  `lock_until` integer,
  `phase` text,
  `progress_current` integer,
  `progress_total` integer,
  `error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_user_id_unique` ON `sync_state` (`user_id`);
