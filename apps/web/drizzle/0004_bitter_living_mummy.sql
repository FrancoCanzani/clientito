CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`domain` text NOT NULL,
	`email_count` integer DEFAULT 1 NOT NULL,
	`latest_email_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_org_email_unique` ON `contacts` (`org_id`,`email`);--> statement-breakpoint
CREATE INDEX `contacts_org_domain_idx` ON `contacts` (`org_id`,`domain`);