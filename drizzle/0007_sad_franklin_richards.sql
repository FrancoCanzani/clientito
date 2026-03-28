CREATE TABLE `briefing_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`item_type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`draft_reply` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefing_decisions_user_type_ref_idx` ON `briefing_decisions` (`user_id`,`item_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `briefing_decisions_user_decision_idx` ON `briefing_decisions` (`user_id`,`decision`);