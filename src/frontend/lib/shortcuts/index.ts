export type { ShortcutContext, ShortcutDefinition } from "./types";
export {
  registerShortcut,
  getShortcut,
  getShortcutsForContext,
  getShortcutsForContexts,
  getAllShortcuts,
  findConflicts,
  shortcutKey,
} from "./registry";

import "./definitions";
