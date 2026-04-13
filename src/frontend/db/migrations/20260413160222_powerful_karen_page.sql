CREATE TABLE "labels" (
	"gmail_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mailbox_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'user' NOT NULL,
	"text_color" text,
	"background_color" text,
	"messages_total" integer DEFAULT 0 NOT NULL,
	"messages_unread" integer DEFAULT 0 NOT NULL,
	"synced_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "labels_user_mailbox_idx" ON "labels" USING btree ("user_id","mailbox_id");