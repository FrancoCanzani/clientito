DROP TABLE `drafts`;--> statement-breakpoint
DROP TABLE `user_settings`;--> statement-breakpoint
ALTER TABLE `mailboxes` ADD `sync_window_months` integer;--> statement-breakpoint
ALTER TABLE `mailboxes` ADD `sync_cutoff_at` integer;