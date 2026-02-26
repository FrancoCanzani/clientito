ALTER TABLE `sync_state` ADD `lock_until` integer;--> statement-breakpoint
CREATE INDEX `customers_org_idx` ON `customers` (`org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_org_email_unique` ON `customers` (`org_id`,`email`);--> statement-breakpoint
CREATE INDEX `emails_org_idx` ON `emails` (`org_id`);--> statement-breakpoint
CREATE INDEX `emails_customer_idx` ON `emails` (`customer_id`);--> statement-breakpoint
CREATE INDEX `emails_org_date_idx` ON `emails` (`org_id`,`date`);--> statement-breakpoint
CREATE INDEX `reminders_customer_idx` ON `reminders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `reminders_org_done_idx` ON `reminders` (`org_id`,`done`);