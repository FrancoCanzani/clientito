import { useEffect, useEffectEvent, useRef } from "react";
import { tinykeys, type KeyBindingMap } from "tinykeys";

type HotkeyHandler = (event: KeyboardEvent) => void;

type HotkeyBinding =
  | HotkeyHandler
  | {
      onKeyDown: HotkeyHandler;
      enabled?: boolean;
      preventDefault?: boolean;
      allowInEditable?: boolean;
    };

type UseHotkeysOptions = {
  enabled?: boolean;
  target?: Window | HTMLElement | null;
  allowInEditable?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function normalizeBinding(binding: HotkeyBinding) {
  return typeof binding === "function" ? { onKeyDown: binding } : binding;
}

export function useHotkeys(
  bindings: Record<string, HotkeyBinding>,
  options: UseHotkeysOptions = {},
) {
  const {
    enabled = true,
    target = typeof window === "undefined" ? null : window,
    allowInEditable = false,
  } = options;

  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const optionsRef = useRef({ enabled, allowInEditable });
  optionsRef.current = { enabled, allowInEditable };

  const runBinding = useEffectEvent((key: string, event: KeyboardEvent) => {
    const binding = bindingsRef.current[key];
    if (!binding) return;

    const {
      onKeyDown,
      enabled: bindingEnabled = true,
      preventDefault = true,
      allowInEditable: allowBindingInEditable = optionsRef.current.allowInEditable,
    } = normalizeBinding(binding);

    if (!bindingEnabled) return;
    if (!allowBindingInEditable && isEditableTarget(event.target)) return;
    if (preventDefault) {
      event.preventDefault();
    }

    onKeyDown(event);
  });

  useEffect(() => {
    if (!enabled || !target) return;

    const keys = Object.keys(bindingsRef.current);
    const keyBindingMap: KeyBindingMap = Object.fromEntries(
      keys.map((key) => [
        key,
        (event: KeyboardEvent) => runBinding(key, event),
      ]),
    );

    return tinykeys(target, keyBindingMap);
  }, [enabled, target, runBinding]);
}