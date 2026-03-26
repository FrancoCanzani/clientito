CREATE TABLE `scheduled_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`to` text NOT NULL,
	`cc` text,
	`bcc` text,
	`subject` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`in_reply_to` text,
	`references` text,
	`thread_id` text,
	`attachment_keys` text,
	`scheduled_for` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_emails_pending_idx` ON `scheduled_emails` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `scheduled_emails_user_idx` ON `scheduled_emails` (`user_id`,`status`);