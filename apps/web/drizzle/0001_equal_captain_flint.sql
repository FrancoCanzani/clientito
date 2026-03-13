CREATE TABLE `email_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`label` text NOT NULL,
	`params` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_suggestions_user_status_idx` ON `email_suggestions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `email_suggestions_email_idx` ON `email_suggestions` (`email_id`);