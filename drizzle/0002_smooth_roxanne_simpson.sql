CREATE TABLE `ai_thread_intelligence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`thread_id` text NOT NULL,
	`source_last_message_id` text NOT NULL,
	`source_message_count` integer NOT NULL,
	`summary` text,
	`latest_reply_draft_body` text,
	`latest_reply_draft_intent` text,
	`latest_reply_draft_tone` text,
	`summary_updated_at` integer,
	`reply_draft_updated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_thread_intelligence_thread_idx` ON `ai_thread_intelligence` (`user_id`,`mailbox_id`,`thread_id`);--> statement-breakpoint
CREATE INDEX `ai_thread_intelligence_mailbox_idx` ON `ai_thread_intelligence` (`user_id`,`mailbox_id`);--> statement-breakpoint
CREATE TABLE `ai_usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`feature` text NOT NULL,
	`plan` text NOT NULL,
	`model_route` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`status` text NOT NULL,
	`error_code` text,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_usage_events_user_created_idx` ON `ai_usage_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_events_mailbox_created_idx` ON `ai_usage_events` (`mailbox_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `mailboxes` ADD `signatures_synced_at` integer;