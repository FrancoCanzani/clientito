ALTER TABLE `sync_state` ADD `phase` text;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `progress_current` integer;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `progress_total` integer;--> statement-breakpoint
ALTER TABLE `sync_state` ADD `error` text;