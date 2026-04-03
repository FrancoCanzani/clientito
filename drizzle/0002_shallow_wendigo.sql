CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`compose_key` text NOT NULL,
	`mailbox_id` integer,
	`to_addr` text DEFAULT '' NOT NULL,
	`cc_addr` text DEFAULT '' NOT NULL,
	`bcc_addr` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`forwarded_content` text DEFAULT '' NOT NULL,
	`thread_id` text,
	`attachment_keys` text,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_user_compose_key_idx` ON `drafts` (`user_id`,`compose_key`);--> statement-breakpoint
CREATE INDEX `drafts_user_updated_idx` ON `drafts` (`user_id`,`updated_at`);