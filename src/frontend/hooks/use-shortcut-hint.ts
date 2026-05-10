import { getShortcut } from "@/lib/shortcuts";
import { useRef } from "react";
import { toast } from "sonner";

export function useShortcutHint() {
  const lastShown = useRef(new Map<string, number>());

  return (shortcutId: string) => {
    const def = getShortcut(shortcutId);
    if (!def) return;

    const now = Date.now();
    if (now - (lastShown.current.get(shortcutId) ?? 0) < 60_000) return;
    lastShown.current.set(shortcutId, now);

    toast(`Tip: Press ${def.key} to ${def.label.toLowerCase()}`);
  };
}
