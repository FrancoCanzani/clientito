ALTER TABLE `emails` ADD `cc_addr` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `snoozed_until` integer;--> statement-breakpoint
CREATE INDEX `emails_user_snoozed_idx` ON `emails` (`user_id`,`snoozed_until`);