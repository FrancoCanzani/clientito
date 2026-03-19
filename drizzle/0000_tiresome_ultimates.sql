CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `daily_briefings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`narrative` text,
	`unread_count` integer,
	`follow_up_count` integer,
	`tasks_due_count` integer,
	`overdue_count` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_briefings_user_date_idx` ON `daily_briefings` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `email_filters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`conditions` text NOT NULL,
	`actions` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_filters_user_idx` ON `email_filters` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_filters_user_priority_idx` ON `email_filters` (`user_id`,`priority`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`gmail_id` text NOT NULL,
	`thread_id` text,
	`message_id` text,
	`from_addr` text NOT NULL,
	`from_name` text,
	`to_addr` text,
	`subject` text,
	`snippet` text,
	`body_text` text,
	`body_html` text,
	`date` integer NOT NULL,
	`direction` text,
	`is_read` integer DEFAULT false NOT NULL,
	`label_ids` text,
	`ai_label` text,
	`unsubscribe_url` text,
	`unsubscribe_email` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_gmail_id_unique` ON `emails` (`gmail_id`);--> statement-breakpoint
CREATE INDEX `emails_user_idx` ON `emails` (`user_id`);--> statement-breakpoint
CREATE INDEX `emails_user_date_idx` ON `emails` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `emails_thread_idx` ON `emails` (`thread_id`);--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`gmail_email` text,
	`history_id` text,
	`auth_state` text DEFAULT 'unknown' NOT NULL,
	`last_successful_sync_at` integer,
	`last_error_at` integer,
	`last_error_message` text,
	`lock_until` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_user_id_unique` ON `mailboxes` (`user_id`);--> statement-breakpoint
CREATE INDEX `mailboxes_auth_state_idx` ON `mailboxes` (`auth_state`);--> statement-breakpoint
CREATE INDEX `mailboxes_last_success_idx` ON `mailboxes` (`last_successful_sync_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'Untitled note' NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_user_updated_idx` ON `notes` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` integer NOT NULL,
	`kind` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`phase` text,
	`progress_current` integer,
	`progress_total` integer,
	`attempt` integer DEFAULT 1 NOT NULL,
	`error_class` text,
	`error_message` text,
	`run_after_at` integer,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_jobs_mailbox_created_idx` ON `sync_jobs` (`mailbox_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sync_jobs_mailbox_status_idx` ON `sync_jobs` (`mailbox_id`,`status`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`due_time` text,
	`priority` text DEFAULT 'low' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` integer,
	`parent_id` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`recurrence` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_user_status_idx` ON `tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`user_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_id`);