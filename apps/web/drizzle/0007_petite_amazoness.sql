ALTER TABLE `emails` ADD `from_name` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `is_read` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `label_ids` text;