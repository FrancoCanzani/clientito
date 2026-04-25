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
CREATE TABLE `mailboxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`provider` text DEFAULT 'google' NOT NULL,
	`email` text,
	`signature` text,
	`templates` text,
	`history_id` text,
	`sync_window_months` integer,
	`sync_cutoff_at` integer,
	`auth_state` text DEFAULT 'unknown' NOT NULL,
	`last_successful_sync_at` integer,
	`last_error_at` integer,
	`last_error_message` text,
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
CREATE TABLE `split_views` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text,
	`color` text,
	`position` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`system_key` text,
	`rules` text,
	`match_mode` text DEFAULT 'rules' NOT NULL,
	`show_in_other` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `split_views_user_idx` ON `split_views` (`user_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `split_views_user_system_idx` ON `split_views` (`user_id`,`system_key`);--> statement-breakpoint
CREATE TABLE `trust_entities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`mailbox_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_value` text NOT NULL,
	`trust_level` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trust_entities_unique_entity_idx` ON `trust_entities` (`user_id`,`mailbox_id`,`entity_type`,`entity_value`);--> statement-breakpoint
CREATE INDEX `trust_entities_user_mailbox_idx` ON `trust_entities` (`user_id`,`mailbox_id`);--> statement-breakpoint
CREATE INDEX `trust_entities_level_idx` ON `trust_entities` (`trust_level`);