ALTER TABLE `notes` ADD `title` text DEFAULT 'Untitled note' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `notes_user_updated_idx` ON `notes` (`user_id`,`updated_at`);