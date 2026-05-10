export type ShortcutContext =
  | "global"
  | "inbox-list"
  | "email-detail"
  | "triage"
  | "todo"
  | "compose"
  | "command-palette"
  | "search"
  | "settings";

export interface ShortcutDefinition {
  id: string;
  key: string;
  label: string;
  category: string;
  contexts: ShortcutContext[];
  allowInEditable?: boolean;
  preventDefault?: boolean;
}

export type ShortcutAction = (
  event: KeyboardEvent,
  def: ShortcutDefinition,
) => void;

export interface UseShortcutsOptions {
  enabled?: boolean;
  target?: Window | HTMLElement | null;
  allowInEditable?: boolean;
}
