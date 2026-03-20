PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_email_filters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`conditions` text DEFAULT '[]' NOT NULL,
	`actions` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_filters`("id", "user_id", "name", "description", "conditions", "actions", "enabled", "priority", "created_at") SELECT "id", "user_id", "name", "description", "conditions", "actions", "enabled", "priority", "created_at" FROM `email_filters`;--> statement-breakpoint
DROP TABLE `email_filters`;--> statement-breakpoint
ALTER TABLE `__new_email_filters` RENAME TO `email_filters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `email_filters_user_idx` ON `email_filters` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_filters_user_priority_idx` ON `email_filters` (`user_id`,`priority`);