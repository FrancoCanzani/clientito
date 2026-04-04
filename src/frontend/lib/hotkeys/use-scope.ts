import type { ShortcutScope } from "@/config/shortcuts";
import { useHotkeysContext } from "react-hotkeys-hook";
import { useEffect } from "react";

export function useHotkeyScope(scope: ShortcutScope) {
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    enableScope(scope);
    return () => {
      disableScope(scope);
    };
  }, [scope, enableScope, disableScope]);
}
