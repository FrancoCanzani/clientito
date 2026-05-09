CREATE TABLE `reply_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`thread_id` text NOT NULL,
	`sent_message_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	`remind_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`surfaced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reply_reminders_thread_idx` ON `reply_reminders` (`user_id`,`mailbox_id`,`thread_id`);--> statement-breakpoint
CREATE INDEX `reply_reminders_due_idx` ON `reply_reminders` (`status`,`remind_at`);--> statement-breakpoint
CREATE INDEX `reply_reminders_user_status_idx` ON `reply_reminders` (`user_id`,`status`);