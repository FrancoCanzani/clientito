import type { ShortcutScope } from "@/lib/hotkeys/shortcuts";
import { useEffect } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";

export function useHotkeyScope(scope: ShortcutScope) {
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    enableScope(scope);
    return () => {
      disableScope(scope);
    };
  }, [scope, enableScope, disableScope]);
}
