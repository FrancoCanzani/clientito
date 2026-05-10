import { Kbd } from "@/components/ui/kbd";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { getAllShortcuts } from "@/lib/shortcuts";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo, useState } from "react";

function useShortcutGroups() {
  return useMemo(() => {
    const all = getAllShortcuts();
    const groups = new Map<string, { key: string; description: string }[]>();

    for (const def of all) {
      let list = groups.get(def.category);
      if (!list) {
        list = [];
        groups.set(def.category, list);
      }
      list.push({ key: def.key, description: def.label });
    }

    const sorted = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Global") return -1;
      if (b[0] === "Global") return 1;
      return a[0].localeCompare(b[0]);
    });

    return sorted.map(([label, shortcuts]) => ({
      label,
      shortcuts: shortcuts.sort((a, b) => a.key.localeCompare(b.key)),
    }));
  }, []);
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const groups = useShortcutGroups();

  useShortcuts("global", {
    "global:keyboard-shortcuts": () => setOpen((isOpen) => !isOpen),
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[oklch(12%_0.01_250)]/30 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-5 shadow-xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150">
          <DialogPrimitive.Title className="text-sm font-medium text-foreground">
            Keyboard shortcuts
          </DialogPrimitive.Title>

          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key + shortcut.description}
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
