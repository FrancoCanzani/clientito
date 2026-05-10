import { registerShortcut } from "./registry";

registerShortcut({
  id: "global:command-palette",
  key: "$mod+k",
  label: "Open command palette",
  category: "Global",
  contexts: ["global"],
  allowInEditable: true,
});

registerShortcut({
  id: "global:toggle-sidebar",
  key: "$mod+b",
  label: "Toggle sidebar",
  category: "Global",
  contexts: ["global"],
});

registerShortcut({
  id: "global:keyboard-shortcuts",
  key: "?",
  label: "Show keyboard shortcuts",
  category: "Global",
  contexts: ["global"],
});

registerShortcut({
  id: "global:next-account",
  key: "$mod+Shift+ArrowDown",
  label: "Next account",
  category: "Global",
  contexts: ["global"],
});

registerShortcut({
  id: "global:prev-account",
  key: "$mod+Shift+ArrowUp",
  label: "Previous account",
  category: "Global",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:inbox",
  key: "g i",
  label: "Go to inbox",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:triage",
  key: "g f",
  label: "Go to triage",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:todo",
  key: "g t",
  label: "Go to to-do",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:drafts",
  key: "g d",
  label: "Go to drafts",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:settings",
  key: "g ,",
  label: "Go to settings",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:starred",
  key: "g s",
  label: "Go to starred",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:archived",
  key: "g a",
  label: "Go to archived",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:sent",
  key: "g e",
  label: "Go to sent",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:spam",
  key: "g p",
  label: "Go to spam",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:trash",
  key: "g x",
  label: "Go to trash",
  category: "Navigation",
  contexts: ["global"],
});

for (let i = 1; i <= 9; i++) {
  registerShortcut({
    id: `nav:account-${i}`,
    key: `$mod+${i}`,
    label: `Switch to account ${i}`,
    category: "Navigation",
    contexts: ["global"],
  });
}

registerShortcut({
  id: "inbox:next",
  key: "j",
  label: "Next email",
  category: "Navigation",
  contexts: ["inbox-list", "todo"],
});

registerShortcut({
  id: "inbox:next-arrow",
  key: "ArrowDown",
  label: "Next email",
  category: "Navigation",
  contexts: ["inbox-list", "todo"],
});

registerShortcut({
  id: "inbox:prev",
  key: "k",
  label: "Previous email",
  category: "Navigation",
  contexts: ["inbox-list", "todo"],
});

registerShortcut({
  id: "inbox:prev-arrow",
  key: "ArrowUp",
  label: "Previous email",
  category: "Navigation",
  contexts: ["inbox-list", "todo"],
});

registerShortcut({
  id: "inbox:open",
  key: "Enter",
  label: "Open email",
  category: "Navigation",
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "action:archive",
  key: "e",
  label: "Mark as done",
  category: "Actions",
  contexts: ["inbox-list", "email-detail", "triage", "todo"],
});

registerShortcut({
  id: "action:reply",
  key: "r",
  label: "Reply",
  category: "Actions",
  contexts: ["email-detail", "triage", "todo"],
});

registerShortcut({
  id: "action:forward",
  key: "f",
  label: "Forward",
  category: "Actions",
  contexts: ["email-detail", "todo"],
});

registerShortcut({
  id: "action:star",
  key: "s",
  label: "Toggle star",
  category: "Actions",
  contexts: ["inbox-list", "email-detail"],
});

registerShortcut({
  id: "action:toggle-read",
  key: "u",
  label: "Toggle read / unread",
  category: "Actions",
  contexts: ["inbox-list", "email-detail", "todo"],
});

registerShortcut({
  id: "action:trash",
  key: "#",
  label: "Move to trash",
  category: "Actions",
  contexts: ["inbox-list", "email-detail", "triage"],
});

registerShortcut({
  id: "action:compose",
  key: "c",
  label: "Compose new email",
  category: "Actions",
  contexts: ["global"],
});

registerShortcut({
  id: "action:search",
  key: "/",
  label: "Search",
  category: "Actions",
  contexts: ["inbox-list", "todo"],
});

registerShortcut({
  id: "action:snooze",
  key: "s",
  label: "Snooze",
  category: "Actions",
  contexts: ["triage", "todo"],
});

registerShortcut({
  id: "action:todo",
  key: "t",
  label: "Add to to-do",
  category: "Actions",
  contexts: ["triage"],
});

registerShortcut({
  id: "action:esc",
  key: "Escape",
  label: "Go back / close",
  category: "Actions",
  contexts: ["global", "email-detail", "triage", "todo", "search"],
});

registerShortcut({
  id: "detail:next",
  key: "j",
  label: "Next email",
  category: "Navigation",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "detail:next-arrow",
  key: "ArrowDown",
  label: "Next email",
  category: "Navigation",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "detail:prev",
  key: "k",
  label: "Previous email",
  category: "Navigation",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "detail:prev-arrow",
  key: "ArrowUp",
  label: "Previous email",
  category: "Navigation",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "triage:advance",
  key: "j",
  label: "Next email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "triage:advance-arrow",
  key: "ArrowDown",
  label: "Next email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "triage:advance-arrow-right",
  key: "ArrowRight",
  label: "Next email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "triage:prev",
  key: "k",
  label: "Previous email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "triage:prev-arrow",
  key: "ArrowUp",
  label: "Previous email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "triage:prev-arrow-left",
  key: "ArrowLeft",
  label: "Previous email",
  category: "Navigation",
  contexts: ["triage"],
});

registerShortcut({
  id: "compose:focus-to",
  key: "o",
  label: "Focus To",
  category: "Compose",
  contexts: ["compose"],
});

registerShortcut({
  id: "compose:focus-cc",
  key: "c",
  label: "Focus Cc",
  category: "Compose",
  contexts: ["compose"],
});

registerShortcut({
  id: "compose:focus-bcc",
  key: "b",
  label: "Focus Bcc",
  category: "Compose",
  contexts: ["compose"],
});

registerShortcut({
  id: "compose:focus-subject",
  key: "s",
  label: "Focus subject",
  category: "Compose",
  contexts: ["compose"],
});

registerShortcut({
  id: "compose:focus-body",
  key: "m",
  label: "Focus message body",
  category: "Compose",
  contexts: ["compose"],
});

registerShortcut({
  id: "todo:select",
  key: "Enter",
  label: "Select email",
  category: "Navigation",
  contexts: ["todo"],
});

registerShortcut({
  id: "action:delete",
  key: "Delete",
  label: "Remove from to-do",
  category: "Actions",
  contexts: ["todo"],
});

registerShortcut({
  id: "action:backspace",
  key: "Backspace",
  label: "Remove from to-do",
  category: "Actions",
  contexts: ["todo"],
});

registerShortcut({
  id: "action:archive-todo",
  key: "a",
  label: "Archive and remove from to-do",
  category: "Actions",
  contexts: ["todo"],
});

registerShortcut({
  id: "action:label",
  key: "l",
  label: "Label",
  category: "Actions",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "search:next",
  key: "j",
  label: "Next result",
  category: "Navigation",
  contexts: ["search"],
});

registerShortcut({
  id: "search:prev",
  key: "k",
  label: "Previous result",
  category: "Navigation",
  contexts: ["search"],
});

registerShortcut({
  id: "search:next-arrow",
  key: "ArrowDown",
  label: "Next result",
  category: "Navigation",
  contexts: ["search"],
  allowInEditable: true,
});

registerShortcut({
  id: "search:prev-arrow",
  key: "ArrowUp",
  label: "Previous result",
  category: "Navigation",
  contexts: ["search"],
  allowInEditable: true,
});

registerShortcut({
  id: "nav:search",
  key: "g /",
  label: "Go to search",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "nav:screener",
  key: "g n",
  label: "Go to screener",
  category: "Navigation",
  contexts: ["global"],
});

registerShortcut({
  id: "action:reply-all",
  key: "a",
  label: "Reply all",
  category: "Actions",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "action:refresh",
  key: ".",
  label: "Refresh",
  category: "Actions",
  contexts: ["inbox-list"],
});
