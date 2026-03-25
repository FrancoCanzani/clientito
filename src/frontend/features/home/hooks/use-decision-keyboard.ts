import { shouldIgnoreHotkeyTarget } from "@/lib/hotkeys";
import { useHotkey } from "@tanstack/react-hotkeys";

type DecisionKeyboardActions = {
  navigateUp: () => void;
  navigateDown: () => void;
  toggleEditing: () => void;
  cancelEditing: () => void;
  sendActiveReply: () => void;
  skipActive: () => void;
  archiveActive: () => void;
  enabled: boolean;
};

function guard(enabled: boolean, event: KeyboardEvent, fn: () => void) {
  if (!enabled || shouldIgnoreHotkeyTarget(event.target)) return;
  event.preventDefault();
  fn();
}

export function useDecisionKeyboard(actions: DecisionKeyboardActions) {
  const opts = { preventDefault: false, stopPropagation: false, enabled: actions.enabled };

  useHotkey("j", (e) => guard(actions.enabled, e, actions.navigateDown), opts);
  useHotkey("ArrowDown", (e) => guard(actions.enabled, e, actions.navigateDown), opts);
  useHotkey("k", (e) => guard(actions.enabled, e, actions.navigateUp), opts);
  useHotkey("ArrowUp", (e) => guard(actions.enabled, e, actions.navigateUp), opts);
  useHotkey("e", (e) => guard(actions.enabled, e, actions.toggleEditing), opts);
  useHotkey("Enter", (e) => guard(actions.enabled, e, actions.sendActiveReply), opts);
  useHotkey("s", (e) => guard(actions.enabled, e, actions.skipActive), opts);
  useHotkey("a", (e) => guard(actions.enabled, e, actions.archiveActive), opts);
  useHotkey("Escape", (e) => { if (actions.enabled) { e.preventDefault(); actions.cancelEditing(); } }, opts);
}
