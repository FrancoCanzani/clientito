import * as SQLite from "wa-sqlite";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite.mjs";
import { AccessHandlePoolVFS } from "wa-sqlite/src/examples/AccessHandlePoolVFS.js";

let sqlite3: SQLiteAPI;
let db: number;
let vfs: AccessHandlePoolVFS;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mailbox_id INTEGER,
  provider_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  from_addr TEXT NOT NULL,
  from_name TEXT,
  to_addr TEXT,
  cc_addr TEXT,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
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
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_user_mailbox_date ON emails(user_id, mailbox_id, date);
CREATE INDEX IF NOT EXISTS emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS emails_provider_msg ON emails(provider_message_id);

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mailbox_id INTEGER,
  sender_key TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  from_name TEXT,
  unsubscribe_url TEXT,
  unsubscribe_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  email_count INTEGER NOT NULL DEFAULT 0,
  last_received_at INTEGER,
  unsubscribe_method TEXT,
  unsubscribe_requested_at INTEGER,
  unsubscribed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(mailbox_id, sender_key)
);

CREATE INDEX IF NOT EXISTS email_subscriptions_status ON email_subscriptions(status);

CREATE TABLE IF NOT EXISTS labels (
  gmail_id TEXT PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_subject ON emails(subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_name ON emails(from_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_addr ON emails(from_addr COLLATE NOCASE);
`;

const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA locking_mode = EXCLUSIVE;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -8000;
PRAGMA page_size = 8192;
PRAGMA temp_store = MEMORY;
`;

const DB_DIRECTORY = "/petit-db";

async function init() {
  const module = await SQLiteESMFactory();
  sqlite3 = SQLite.Factory(module);

  vfs = new AccessHandlePoolVFS(DB_DIRECTORY);
  await vfs.isReady;
  sqlite3.vfs_register(vfs as unknown as SQLiteVFS, true);

  db = await sqlite3.open_v2("petit.db");
  await sqlite3.exec(db, PRAGMAS);
  await sqlite3.exec(db, SCHEMA_SQL);
}

async function deleteDatabase(): Promise<void> {
  await sqlite3.close(db);
  await vfs.close();
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(DB_DIRECTORY, { recursive: true });
}

type RpcRequest = {
  id: number;
  method: "all" | "run" | "get" | "values" | "close" | "delete-db";
  sql: string;
  params: unknown[];
};

type RpcResponse = {
  id: number;
  rows?: unknown[][];
  columns?: string[];
  error?: string;
};

async function handleQuery(req: RpcRequest): Promise<RpcResponse> {
  try {
    if (req.method === "close") {
      await sqlite3.close(db);
      return { id: req.id };
    }

    if (req.method === "delete-db") {
      await deleteDatabase();
      return { id: req.id };
    }

    const rows: unknown[][] = [];
    let columns: string[] = [];

    for await (const stmt of sqlite3.statements(db, req.sql)) {
      if (req.params.length > 0) {
        sqlite3.bind_collection(
          stmt,
          req.params as Array<number | string | Uint8Array | null>,
        );
      }

      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        if (columns.length === 0) {
          columns = sqlite3.column_names(stmt);
        }
        rows.push(sqlite3.row(stmt));
      }
    }

    if (req.method === "run") {
      return { id: req.id, rows: [], columns: [] };
    }

    if (req.method === "get") {
      return { id: req.id, rows: rows.slice(0, 1), columns };
    }

    return { id: req.id, rows, columns };
  } catch (e) {
    return { id: req.id, error: e instanceof Error ? e.message : String(e) };
  }
}

const ready = init();

let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<RpcRequest>) => {
  queue = queue.then(async () => {
    await ready;
    const response = await handleQuery(event.data);
    self.postMessage(response);
  });
};
