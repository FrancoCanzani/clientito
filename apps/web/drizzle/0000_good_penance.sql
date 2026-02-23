CREATE TABLE `ai_rewrites` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`user_id` text NOT NULL,
	`input_md` text NOT NULL,
	`output_md` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`track_event` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checklist_id`) REFERENCES `checklists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`target_traits` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `impressions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`release_id` text,
	`end_user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_impressions_project` ON `impressions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mau_daily` (
	`project_id` text NOT NULL,
	`day` text NOT NULL,
	`end_user_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `day`, `end_user_id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_provider_account` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `org_members` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sdk_key` text NOT NULL,
	`custom_domain` text,
	`custom_domain_status` text DEFAULT 'none',
	`cf_hostname_id` text,
	`branding_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_sdk_key_unique` ON `projects` (`sdk_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_org_slug` ON `projects` (`org_id`,`slug`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`version` text,
	`content_md` text NOT NULL,
	`content_html` text,
	`ai_rewrite_md` text,
	`ai_rewrite_html` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`display_type` text DEFAULT 'modal' NOT NULL,
	`publish_at` integer,
	`published_at` integer,
	`unpublish_at` integer,
	`show_once` integer DEFAULT true NOT NULL,
	`target_traits` text,
	`metadata` text,
	`source` text DEFAULT 'manual',
	`source_ref` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_project_slug` ON `releases` (`project_id`,`slug`);--> statement-breakpoint
CREATE TABLE `sdk_configs` (
	`project_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT '{}',
	`position` text DEFAULT 'bottom-right',
	`z_index` integer DEFAULT 99999,
	`custom_css` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `usage_monthly` (
	`project_id` text NOT NULL,
	`month` text NOT NULL,
	`mau_count` integer DEFAULT 0 NOT NULL,
	`impression_count` integer DEFAULT 0 NOT NULL,
	`ai_rewrite_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`project_id`, `month`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password_hash` text,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);