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
CREATE INDEX `trust_entities_level_idx` ON `trust_entities` (`trust_level`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_split_views` (
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
INSERT INTO `__new_split_views`("id", "user_id", "name", "description", "icon", "color", "position", "visible", "pinned", "is_system", "system_key", "rules", "match_mode", "show_in_other", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "icon", "color", "position", "visible", "pinned", "is_system", "system_key", "rules", "match_mode", "show_in_other", "created_at", "updated_at" FROM `split_views`;--> statement-breakpoint
DROP TABLE `split_views`;--> statement-breakpoint
ALTER TABLE `__new_split_views` RENAME TO `split_views`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `split_views_user_idx` ON `split_views` (`user_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `split_views_user_system_idx` ON `split_views` (`user_id`,`system_key`);