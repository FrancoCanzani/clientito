import { Kbd } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

type ShortcutDefinition = {
  key: string;
  description: string;
};

type ShortcutGroup = {
  label: string;
  shortcuts: ShortcutDefinition[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "Navigation",
    shortcuts: [
      { key: "J", description: "Next email" },
      { key: "K", description: "Previous email" },
      { key: "Enter", description: "Open email" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { key: "E", description: "Mark as done" },
      { key: "R", description: "Reply" },
      { key: "S", description: "Toggle star" },
      { key: "U", description: "Toggle read/unread" },
      { key: "#", description: "Move to trash" },
      { key: "C", description: "Compose new email" },
      { key: "Esc", description: "Go back" },
    ],
  },
  {
    label: "Compose",
    shortcuts: [
      { key: "O", description: "Focus To" },
      { key: "C", description: "Focus Cc" },
      { key: "B", description: "Focus Bcc" },
      { key: "S", description: "Focus subject" },
      { key: "M", description: "Focus message body" },
      { key: "⌘ Enter", description: "Send message" },
    ],
  },
  {
    label: "Global",
    shortcuts: [
      { key: "⌘ K", description: "Command palette" },
      { key: "⌘ B", description: "Toggle sidebar" },
      { key: "?", description: "Keyboard shortcuts" },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useHotkeys({
    "?": () => setOpen((isOpen) => !isOpen),
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background p-5 shadow-xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
          <DialogPrimitive.Title className="text-sm font-medium text-foreground">
            Keyboard shortcuts
          </DialogPrimitive.Title>

          <div className="mt-4 space-y-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-0.5"
                    >
                      <span className="text-xs text-foreground">
                        {shortcut.description}
                      </span>
                      <Kbd>{shortcut.key}</Kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
