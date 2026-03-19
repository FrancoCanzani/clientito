/**
 * Agent memory backed by Durable Object SQLite storage.
 * Stores key-value memories that persist across conversations.
 */

export type MemoryEntry = {
  key: string;
  content: string;
  category: "preference" | "context" | "style" | "relationship";
  createdAt: number;
  updatedAt: number;
};

const TABLE_NAME = "agent_memory";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'context',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

export class AgentMemory {
  private initialized = false;

  constructor(private storage: DurableObjectStorage) {}

  private ensureTable() {
    if (this.initialized) return;
    this.storage.sql.exec(CREATE_TABLE_SQL);
    this.initialized = true;
  }

  save(key: string, content: string, category: MemoryEntry["category"] = "context"): void {
    this.ensureTable();
    const now = Date.now();
    this.storage.sql.exec(
      `INSERT INTO ${TABLE_NAME} (key, content, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET content = excluded.content, category = excluded.category, updated_at = excluded.updated_at`,
      key,
      content,
      category,
      now,
      now,
    );
  }

  get(key: string): MemoryEntry | null {
    this.ensureTable();
    const row = this.storage.sql
      .exec(`SELECT key, content, category, created_at, updated_at FROM ${TABLE_NAME} WHERE key = ?`, key)
      .toArray()[0];

    if (!row) return null;

    return {
      key: row.key as string,
      content: row.content as string,
      category: row.category as MemoryEntry["category"],
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  getAll(): MemoryEntry[] {
    this.ensureTable();
    return this.storage.sql
      .exec(`SELECT key, content, category, created_at, updated_at FROM ${TABLE_NAME} ORDER BY updated_at DESC`)
      .toArray()
      .map((row) => ({
        key: row.key as string,
        content: row.content as string,
        category: row.category as MemoryEntry["category"],
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      }));
  }

  getByCategory(category: MemoryEntry["category"]): MemoryEntry[] {
    this.ensureTable();
    return this.storage.sql
      .exec(
        `SELECT key, content, category, created_at, updated_at FROM ${TABLE_NAME} WHERE category = ? ORDER BY updated_at DESC`,
        category,
      )
      .toArray()
      .map((row) => ({
        key: row.key as string,
        content: row.content as string,
        category: row.category as MemoryEntry["category"],
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      }));
  }

  delete(key: string): void {
    this.ensureTable();
    this.storage.sql.exec(`DELETE FROM ${TABLE_NAME} WHERE key = ?`, key);
  }

  formatForPrompt(): string {
    const entries = this.getAll();
    if (entries.length === 0) return "";

    const grouped = new Map<string, MemoryEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.category) ?? [];
      list.push(entry);
      grouped.set(entry.category, list);
    }

    const sections: string[] = [];

    for (const [category, items] of grouped) {
      const lines = items.map((e) => `- ${e.key}: ${e.content}`).join("\n");
      sections.push(`[${category}]\n${lines}`);
    }

    return `\n\nUser memory (things you've learned about this user across conversations):\n${sections.join("\n\n")}`;
  }
}
