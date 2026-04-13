CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"compose_key" text NOT NULL,
	"mailbox_id" integer,
	"to_addr" text DEFAULT '' NOT NULL,
	"cc_addr" text DEFAULT '' NOT NULL,
	"bcc_addr" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"forwarded_content" text DEFAULT '' NOT NULL,
	"thread_id" text,
	"attachment_keys" jsonb,
	"updated_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_intelligence" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"mailbox_id" integer,
	"category" text,
	"summary" text,
	"suspicious_json" jsonb DEFAULT '{"isSuspicious":false}'::jsonb NOT NULL,
	"actions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_hash" text,
	"model" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"last_processed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mailbox_id" integer,
	"sender_key" text NOT NULL,
	"from_addr" text NOT NULL,
	"from_name" text,
	"unsubscribe_url" text,
	"unsubscribe_email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"email_count" integer DEFAULT 0 NOT NULL,
	"last_received_at" bigint,
	"unsubscribe_method" text,
	"unsubscribe_requested_at" bigint,
	"unsubscribed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mailbox_id" integer,
	"provider_message_id" text NOT NULL,
	"thread_id" text,
	"from_addr" text NOT NULL,
	"from_name" text,
	"to_addr" text,
	"cc_addr" text,
	"subject" text,
	"snippet" text,
	"body_text" text,
	"body_html" text,
	"date" bigint NOT NULL,
	"direction" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"label_ids" jsonb,
	"unsubscribe_url" text,
	"unsubscribe_email" text,
	"snoozed_until" bigint,
	"created_at" bigint NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("emails"."subject", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("emails"."from_name", '')), 'B') ||
            setweight(to_tsvector('english', coalesce("emails"."from_addr", '')), 'B') ||
            setweight(to_tsvector('english', coalesce("emails"."snippet", '')), 'C') ||
            setweight(to_tsvector('english', coalesce("emails"."body_text", '')), 'D')) STORED,
	CONSTRAINT "emails_provider_message_id_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_compose_key_idx" ON "drafts" USING btree ("user_id","compose_key");--> statement-breakpoint
CREATE INDEX "drafts_updated_idx" ON "drafts" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_intelligence_email_idx" ON "email_intelligence" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_intelligence_status_idx" ON "email_intelligence" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "email_subscriptions_mailbox_sender_idx" ON "email_subscriptions" USING btree ("mailbox_id","sender_key");--> statement-breakpoint
CREATE INDEX "email_subscriptions_status_idx" ON "email_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "emails_date_idx" ON "emails" USING btree ("date");--> statement-breakpoint
CREATE INDEX "emails_thread_idx" ON "emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "emails_snoozed_idx" ON "emails" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "emails_mailbox_date_idx" ON "emails" USING btree ("mailbox_id","date");--> statement-breakpoint
CREATE INDEX "emails_search_idx" ON "emails" USING gin ("search_vector");