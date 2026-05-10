import type { ShortcutContext, ShortcutDefinition } from "./types";

const registry = new Map<string, ShortcutDefinition>();
const byContext = new Map<ShortcutContext, Set<string>>();

function indexShortcut(def: ShortcutDefinition) {
  if (registry.has(def.id)) {
    throw new Error(
      `[shortcuts] Duplicate shortcut id: "${def.id}"`,
    );
  }
  registry.set(def.id, def);
  for (const ctx of def.contexts) {
    let set = byContext.get(ctx);
    if (!set) {
      set = new Set();
      byContext.set(ctx, set);
    }
    set.add(def.id);
  }
}

export function registerShortcut(def: ShortcutDefinition): void {
  indexShortcut(def);
}

export function getShortcut(id: string): ShortcutDefinition | undefined {
  return registry.get(id);
}

export function getShortcutsForContext(
  context: ShortcutContext,
): ShortcutDefinition[] {
  const ids = byContext.get(context);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => registry.get(id)!)
    .filter(Boolean);
}

export function getShortcutsForContexts(
  contexts: ShortcutContext[],
): ShortcutDefinition[] {
  const seen = new Set<string>();
  const out: ShortcutDefinition[] = [];
  for (const ctx of contexts) {
    for (const def of getShortcutsForContext(ctx)) {
      if (!seen.has(def.id)) {
        seen.add(def.id);
        out.push(def);
      }
    }
  }
  return out;
}

export function getAllShortcuts(): ShortcutDefinition[] {
  return Array.from(registry.values());
}

export function findConflicts(): Array<[ShortcutDefinition, ShortcutDefinition]> {
  const conflicts: Array<[ShortcutDefinition, ShortcutDefinition]> = [];
  const byKeyAndContext = new Map<string, Map<ShortcutContext, string>>();

  for (const def of registry.values()) {
    for (const ctx of def.contexts) {
      let keyMap = byKeyAndContext.get(def.key);
      if (!keyMap) {
        keyMap = new Map();
        byKeyAndContext.set(def.key, keyMap);
      }
      const existingId = keyMap.get(ctx);
      if (existingId) {
        const existing = registry.get(existingId)!;
        conflicts.push([existing, def]);
      } else {
        keyMap.set(ctx, def.id);
      }
    }
  }

  return conflicts;
}

export function shortcutKey(id: string): string | undefined {
  const def = getShortcut(id);
  if (!def) return undefined;
  return def.key
    .replace(/^\$mod\+/, "\u2318")
    .replace(/^Shift\+/, "\u21E7")
    .replace(/^Alt\+/, "\u2325")
    .replace(/^Ctrl\+/, "\u2303")
    .split(/\s+/)
    .map((part) =>
      part.length === 1 ? part.toUpperCase() : part,
    )
    .join("\u2009");
}
