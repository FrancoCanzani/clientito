PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_email_intelligence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer,
	`category` text,
	`summary` text,
	`suspicious_json` text DEFAULT '{"isSuspicious":false}' NOT NULL,
	`actions_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_hash` text,
	`model` text,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`last_processed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_intelligence`("id", "email_id", "user_id", "mailbox_id", "category", "summary", "suspicious_json", "actions_json", "status", "source_hash", "model", "schema_version", "attempt_count", "error", "last_processed_at", "created_at", "updated_at") SELECT "id", "email_id", "user_id", "mailbox_id", "category", "summary", "suspicious_json", "actions_json", "status", "source_hash", "model", "schema_version", "attempt_count", "error", "last_processed_at", "created_at", "updated_at" FROM `email_intelligence`;--> statement-breakpoint
DROP TABLE `email_intelligence`;--> statement-breakpoint
ALTER TABLE `__new_email_intelligence` RENAME TO `email_intelligence`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `email_intelligence_email_idx` ON `email_intelligence` (`email_id`);--> statement-breakpoint
CREATE INDEX `email_intelligence_user_status_idx` ON `email_intelligence` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `email_intelligence_user_updated_idx` ON `email_intelligence` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `email_intelligence_mailbox_idx` ON `email_intelligence` (`mailbox_id`);