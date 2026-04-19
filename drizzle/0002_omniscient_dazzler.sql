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
	`ai_prompt` text,
	`match_mode` text DEFAULT 'rules_or_ai' NOT NULL,
	`show_in_other` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `split_views_user_idx` ON `split_views` (`user_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `split_views_user_system_idx` ON `split_views` (`user_id`,`system_key`);--> statement-breakpoint
DROP TABLE `sync_jobs`;--> statement-breakpoint
ALTER TABLE `mailboxes` DROP COLUMN `lock_until`;