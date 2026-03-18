CREATE TABLE `mailboxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`gmail_email` text,
	`history_id` text,
	`auth_state` text DEFAULT 'unknown' NOT NULL,
	`watch_expiration_at` integer,
	`last_notification_at` integer,
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`priority` text DEFAULT 'low' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "user_id", "title", "description", "due_at", "priority", "done", "created_at") SELECT "id", "user_id", "title", "description", "due_at", "priority", "done", "created_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tasks_user_done_idx` ON `tasks` (`user_id`,`done`);--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`user_id`,`due_at`);