export interface Shortcut {
  keys: string[];
  action: string;
  description: string;
  scope: ShortcutScope;
  preventDefault?: boolean;
}

export type ShortcutScope = "global" | "inbox" | "home";

const globalShortcuts: Shortcut[] = [
  {
    keys: ["mod", "k"],
    action: "commandPalette",
    description: "Open command palette",
    scope: "global",
  },
  {
    keys: ["mod", "b"],
    action: "toggleSidebar",
    description: "Toggle sidebar",
    scope: "global",
  },
];

const inboxShortcuts: Shortcut[] = [
  {
    keys: ["c"],
    action: "compose",
    description: "Compose new email",
    scope: "inbox",
    preventDefault: true,
  },
  {
    keys: ["e"],
    action: "archive",
    description: "Archive",
    scope: "inbox",
  },
  {
    keys: ["#"],
    action: "trash",
    description: "Trash",
    scope: "inbox",
  },
  {
    keys: ["j"],
    action: "navigateNext",
    description: "Next message",
    scope: "inbox",
  },
  {
    keys: ["ArrowDown"],
    action: "navigateNext",
    description: "Next message",
    scope: "inbox",
  },
  {
    keys: ["k"],
    action: "navigatePrev",
    description: "Previous message",
    scope: "inbox",
  },
  {
    keys: ["ArrowUp"],
    action: "navigatePrev",
    description: "Previous message",
    scope: "inbox",
  },
  {
    keys: ["Enter"],
    action: "open",
    description: "Open message",
    scope: "inbox",
  },
  {
    keys: ["Escape"],
    action: "escape",
    description: "Back / deselect",
    scope: "inbox",
  },
  {
    keys: ["r"],
    action: "reply",
    description: "Reply",
    scope: "inbox",
  },
  {
    keys: ["f"],
    action: "forward",
    description: "Forward",
    scope: "inbox",
  },
  {
    keys: ["u"],
    action: "toggleRead",
    description: "Toggle read/unread",
    scope: "inbox",
  },
  {
    keys: ["s"],
    action: "toggleStar",
    description: "Toggle star",
    scope: "inbox",
  },
];

const homeShortcuts: Shortcut[] = [
  {
    keys: ["j"],
    action: "navigateDown",
    description: "Next card",
    scope: "home",
  },
  {
    keys: ["ArrowDown"],
    action: "navigateDown",
    description: "Next card",
    scope: "home",
  },
  {
    keys: ["k"],
    action: "navigateUp",
    description: "Previous card",
    scope: "home",
  },
  {
    keys: ["ArrowUp"],
    action: "navigateUp",
    description: "Previous card",
    scope: "home",
  },
  {
    keys: ["e"],
    action: "toggleEditing",
    description: "Toggle editing",
    scope: "home",
  },
  {
    keys: ["Enter"],
    action: "confirm",
    description: "Send / confirm",
    scope: "home",
  },
  {
    keys: ["s"],
    action: "skip",
    description: "Skip",
    scope: "home",
  },
  {
    keys: ["a"],
    action: "archiveCard",
    description: "Archive",
    scope: "home",
  },
  {
    keys: ["Escape"],
    action: "cancelEditing",
    description: "Cancel editing",
    scope: "home",
  },
];

export const shortcuts: Shortcut[] = [
  ...globalShortcuts,
  ...inboxShortcuts,
  ...homeShortcuts,
];

export function getShortcutsByScope(scope: ShortcutScope): Shortcut[] {
  return shortcuts.filter((s) => s.scope === scope);
}
