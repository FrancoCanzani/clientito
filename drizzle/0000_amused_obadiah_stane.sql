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
CREATE INDEX `drafts_user_updated_idx` ON `drafts` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `email_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer,
	`sender_key` text NOT NULL,
	`from_addr` text NOT NULL,
	`from_name` text,
	`unsubscribe_url` text,
	`unsubscribe_email` text,
	`status` text DEFAULT 'active' NOT NULL,
	`email_count` integer DEFAULT 0 NOT NULL,
	`last_received_at` integer,
	`unsubscribe_method` text,
	`unsubscribe_requested_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_subscriptions_mailbox_sender_idx` ON `email_subscriptions` (`mailbox_id`,`sender_key`);--> statement-breakpoint
CREATE INDEX `email_subscriptions_user_status_idx` ON `email_subscriptions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `email_subscriptions_user_updated_idx` ON `email_subscriptions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `email_subscriptions_user_last_received_idx` ON `email_subscriptions` (`user_id`,`last_received_at`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer,
	`provider_message_id` text NOT NULL,
	`thread_id` text,
	`message_id` text,
	`from_addr` text NOT NULL,
	`from_name` text,
	`to_addr` text,
	`cc_addr` text,
	`subject` text,
	`snippet` text,
	`body_text` text,
	`body_html` text,
	`date` integer NOT NULL,
	`direction` text,
	`is_read` integer DEFAULT false NOT NULL,
	`label_ids` text,
	`unsubscribe_url` text,
	`unsubscribe_email` text,
	`snoozed_until` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_provider_message_id_unique` ON `emails` (`provider_message_id`);--> statement-breakpoint
CREATE INDEX `emails_user_idx` ON `emails` (`user_id`);--> statement-breakpoint
CREATE INDEX `emails_user_date_idx` ON `emails` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `emails_thread_idx` ON `emails` (`thread_id`);--> statement-breakpoint
CREATE INDEX `emails_user_snoozed_idx` ON `emails` (`user_id`,`snoozed_until`);--> statement-breakpoint
CREATE INDEX `emails_mailbox_date_idx` ON `emails` (`mailbox_id`,`date`);--> statement-breakpoint
CREATE TABLE `labels` (
	`gmail_id` text NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'user' NOT NULL,
	`text_color` text,
	`background_color` text,
	`messages_total` integer DEFAULT 0 NOT NULL,
	`messages_unread` integer DEFAULT 0 NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_mailbox_gmail_idx` ON `labels` (`mailbox_id`,`gmail_id`);--> statement-breakpoint
CREATE INDEX `labels_user_idx` ON `labels` (`user_id`);--> statement-breakpoint
CREATE INDEX `labels_mailbox_idx` ON `labels` (`mailbox_id`);--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`provider` text DEFAULT 'google' NOT NULL,
	`email` text,
	`signature` text,
	`history_id` text,
	`sync_window_months` integer,
	`sync_cutoff_at` integer,
	`auth_state` text DEFAULT 'unknown' NOT NULL,
	`last_successful_sync_at` integer,
	`last_error_at` integer,
	`last_error_message` text,
	`lock_until` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mailboxes_user_idx` ON `mailboxes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_account_idx` ON `mailboxes` (`account_id`);--> statement-breakpoint
CREATE INDEX `mailboxes_auth_state_idx` ON `mailboxes` (`auth_state`);--> statement-breakpoint
CREATE INDEX `mailboxes_last_success_idx` ON `mailboxes` (`last_successful_sync_at`);--> statement-breakpoint
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
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_emails_pending_idx` ON `scheduled_emails` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `scheduled_emails_user_idx` ON `scheduled_emails` (`user_id`,`status`);--> statement-breakpoint
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
CREATE INDEX `sync_jobs_mailbox_status_idx` ON `sync_jobs` (`mailbox_id`,`status`);