ALTER TABLE `tasks` ADD `source_email_id` integer REFERENCES emails(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `tasks_user_source_email_idx` ON `tasks` (`user_id`,`source_email_id`);
