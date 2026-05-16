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
  id: "global:scratchpad",
  key: "$mod+.",
  label: "Open scratchpad",
  category: "Global",
  contexts: ["global"],
  allowInEditable: true,
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
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "inbox:next-arrow",
  key: "ArrowDown",
  label: "Next email",
  category: "Navigation",
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "inbox:prev",
  key: "k",
  label: "Previous email",
  category: "Navigation",
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "inbox:prev-arrow",
  key: "ArrowUp",
  label: "Previous email",
  category: "Navigation",
  contexts: ["inbox-list"],
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
  contexts: ["inbox-list", "email-detail"],
});

registerShortcut({
  id: "action:reply",
  key: "r",
  label: "Reply",
  category: "Actions",
  contexts: ["email-detail"],
});

registerShortcut({
  id: "action:forward",
  key: "f",
  label: "Forward",
  category: "Actions",
  contexts: ["email-detail"],
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
  contexts: ["inbox-list", "email-detail"],
});

registerShortcut({
  id: "action:trash",
  key: "#",
  label: "Move to trash",
  category: "Actions",
  contexts: ["inbox-list", "email-detail"],
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
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "action:esc",
  key: "Escape",
  label: "Go back / close",
  category: "Actions",
  contexts: ["global", "email-detail", "search"],
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
  id: "compose:send",
  key: "$mod+Enter",
  label: "Send email",
  category: "Compose",
  contexts: ["compose"],
  allowInEditable: true,
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
  id: "nav:subscriptions",
  key: "g u",
  label: "Go to subscriptions",
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

registerShortcut({
  id: "inbox:open-in-tab",
  key: "t",
  label: "Open in new tab",
  category: "Navigation",
  contexts: ["inbox-list"],
});

registerShortcut({
  id: "reader:next-tab",
  key: "]",
  label: "Next tab",
  category: "Navigation",
  contexts: ["inbox-list", "email-detail"],
});

registerShortcut({
  id: "reader:prev-tab",
  key: "[",
  label: "Previous tab",
  category: "Navigation",
  contexts: ["inbox-list", "email-detail"],
});

registerShortcut({
  id: "reader:close-tab",
  key: "x",
  label: "Close tab",
  category: "Navigation",
  contexts: ["inbox-list", "email-detail"],
});
