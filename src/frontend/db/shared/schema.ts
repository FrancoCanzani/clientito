export const DB_FILENAME = "/petit.db";
export const SAH_POOL_DIR = ".petit-sahpool";
export const LOCAL_SCHEMA_VERSION = "4";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS emails (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 mailbox_id INTEGER,
 provider_message_id TEXT NOT NULL,
 thread_id TEXT,
 from_addr TEXT NOT NULL,
 from_name TEXT,
 to_addr TEXT,
 cc_addr TEXT,
 subject TEXT,
 snippet TEXT,
 date INTEGER NOT NULL,
 direction TEXT,
 is_read INTEGER NOT NULL DEFAULT 0,
 label_ids TEXT,
 has_inbox INTEGER NOT NULL DEFAULT 0,
 has_sent INTEGER NOT NULL DEFAULT 0,
 has_trash INTEGER NOT NULL DEFAULT 0,
 has_spam INTEGER NOT NULL DEFAULT 0,
 has_starred INTEGER NOT NULL DEFAULT 0,
 unsubscribe_url TEXT,
 unsubscribe_email TEXT,
 snoozed_until INTEGER,
 has_calendar INTEGER NOT NULL DEFAULT 0,
 is_gatekept INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_user_mailbox_date ON emails(user_id, mailbox_id, date);
CREATE INDEX IF NOT EXISTS emails_inbox_cursor ON emails(user_id, mailbox_id, has_inbox, is_gatekept, date DESC, id DESC);
CREATE INDEX IF NOT EXISTS emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS emails_provider_msg ON emails(provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS emails_user_mailbox_provider_msg
 ON emails(user_id, mailbox_id, provider_message_id);
CREATE INDEX IF NOT EXISTS emails_subject ON emails(subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_name ON emails(from_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_addr ON emails(from_addr COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS email_bodies (
 email_id INTEGER PRIMARY KEY,
 body_text TEXT,
 body_html TEXT,
 prepared_body_html TEXT,
 inline_attachments TEXT,
 attachments TEXT,
 FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS email_bodies_email ON email_bodies(email_id);

CREATE TABLE IF NOT EXISTS email_labels (
 email_id INTEGER NOT NULL,
 user_id TEXT NOT NULL,
 mailbox_id INTEGER,
 label_id TEXT NOT NULL,
 date INTEGER NOT NULL,
 PRIMARY KEY (email_id, label_id)
);

CREATE INDEX IF NOT EXISTS email_labels_view
 ON email_labels(user_id, mailbox_id, label_id, date DESC, email_id DESC);

CREATE TABLE IF NOT EXISTS labels (
 gmail_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 mailbox_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'user',
 text_color TEXT,
 background_color TEXT,
 messages_total INTEGER NOT NULL DEFAULT 0,
 messages_unread INTEGER NOT NULL DEFAULT 0,
 synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS labels_user_mailbox ON labels(user_id, mailbox_id);
CREATE UNIQUE INDEX IF NOT EXISTS labels_user_mailbox_gmail
 ON labels(user_id, mailbox_id, gmail_id);

CREATE TABLE IF NOT EXISTS drafts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 compose_key TEXT NOT NULL,
 mailbox_id INTEGER,
 to_addr TEXT NOT NULL DEFAULT '',
 cc_addr TEXT NOT NULL DEFAULT '',
 bcc_addr TEXT NOT NULL DEFAULT '',
 subject TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL DEFAULT '',
 forwarded_content TEXT NOT NULL DEFAULT '',
 thread_id TEXT,
 attachment_keys TEXT,
 updated_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(user_id, compose_key)
);

CREATE INDEX IF NOT EXISTS drafts_updated ON drafts(updated_at);

CREATE TABLE IF NOT EXISTS split_views (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 icon TEXT,
 color TEXT,
 position INTEGER NOT NULL DEFAULT 0,
 visible INTEGER NOT NULL DEFAULT 1,
 pinned INTEGER NOT NULL DEFAULT 0,
 is_system INTEGER NOT NULL DEFAULT 0,
 system_key TEXT,
 rules TEXT,
 match_mode TEXT NOT NULL DEFAULT 'rules',
 show_in_other INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS split_views_user_pos ON split_views(user_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS split_views_user_system
 ON split_views(user_id, system_key) WHERE system_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS _meta (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
`;

export const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -4000;
PRAGMA temp_store = MEMORY;
PRAGMA foreign_keys = ON;
`;

export const EMAIL_SUMMARY_SELECT = `
 id,
 mailbox_id,
 provider_message_id,
 from_addr,
 from_name,
 to_addr,
 cc_addr,
 subject,
 snippet,
 thread_id,
 date,
 direction,
 is_read,
 label_ids,
 has_inbox,
 has_sent,
 has_trash,
 has_spam,
has_starred,
  created_at,
  unsubscribe_url,
  unsubscribe_email,
  snoozed_until,
   has_calendar,
  is_gatekept
`;
