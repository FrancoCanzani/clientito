CREATE TABLE `customer_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`org_id` integer NOT NULL,
	`summary` text NOT NULL,
	`generated_at` integer NOT NULL,
	`trigger_reason` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_summaries_customer_idx` ON `customer_summaries` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_summaries_org_generated_idx` ON `customer_summaries` (`org_id`,`generated_at`);