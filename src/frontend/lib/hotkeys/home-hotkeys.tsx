import { getShortcutsByScope } from "@/lib/hotkeys/shortcuts";
import { useShortcuts } from "@/lib/hotkeys/use-shortcuts";
import { useMemo } from "react";

const homeShortcuts = getShortcutsByScope("home");

type HomeHotkeyActions = {
  navigateUp: () => void;
  navigateDown: () => void;
  toggleEditing: () => void;
  cancelEditing: () => void;
  confirm: () => void;
  skip: () => void;
  archiveCard: () => void;
};

export function useHomeHotkeys(actions: HomeHotkeyActions) {
  const handlers = useMemo(
    () => ({
      navigateDown: actions.navigateDown,
      navigateUp: actions.navigateUp,
      toggleEditing: actions.toggleEditing,
      confirm: actions.confirm,
      skip: actions.skip,
      archiveCard: actions.archiveCard,
      cancelEditing: actions.cancelEditing,
    }),
    [actions],
  );

  useShortcuts(homeShortcuts, handlers, { scope: "home" });
}
