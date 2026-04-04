import type { Shortcut } from "@/config/shortcuts";
import { useHotkeys, type HotkeyCallback } from "react-hotkeys-hook";
import { useCallback, useMemo } from "react";

type HotkeysEvent = Parameters<HotkeyCallback>[1];

export function shouldIgnoreHotkeyTarget(target: EventTarget | null) {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element) return false;
  if (element.isContentEditable) return true;

  return Boolean(
    element.closest(
      "input, textarea, [role='textbox'], [cmdk-root], [data-slot='dialog-content'] textarea",
    ),
  );
}

function formatKeys(keys: string[]): string {
  return keys
    .map((key) => {
      if (key === "mod") return "meta";
      return key;
    })
    .join("+");
}

function buildPressedKey(hotkeysEvent: HotkeysEvent): string {
  const modifiers: string[] = [];
  if (hotkeysEvent.meta) modifiers.push("meta");
  if (hotkeysEvent.ctrl) modifiers.push("ctrl");
  if (hotkeysEvent.alt) modifiers.push("alt");
  if (hotkeysEvent.shift) modifiers.push("shift");
  const base = hotkeysEvent.keys?.join("+") ?? "";
  return modifiers.length > 0 ? `${modifiers.join("+")}+${base}` : base;
}

export function useShortcuts(
  scopeShortcuts: Shortcut[],
  handlers: Record<string, () => void>,
  options: { scope: string },
) {
  const shortcutMap = useMemo(() => {
    const map: Record<string, Shortcut> = {};
    for (const shortcut of scopeShortcuts) {
      if (handlers[shortcut.action]) {
        map[shortcut.action] = shortcut;
      }
    }
    return map;
  }, [scopeShortcuts, handlers]);

  const hotkeyString = useMemo(
    () =>
      Object.values(shortcutMap)
        .map((s) => formatKeys(s.keys))
        .join(","),
    [shortcutMap],
  );

  const handler = useCallback(
    (event: KeyboardEvent, hotkeysEvent: HotkeysEvent) => {
      if (shouldIgnoreHotkeyTarget(event.target)) return;

      const pressed = buildPressedKey(hotkeysEvent);
      const match = Object.entries(shortcutMap).find(
        ([, s]) => formatKeys(s.keys) === pressed,
      );

      if (match) {
        const [action, shortcut] = match;
        if (shortcut.preventDefault) event.preventDefault();
        handlers[action]?.();
      }
    },
    [shortcutMap, handlers],
  );

  useHotkeys(hotkeyString, handler, {
    scopes: [options.scope],
    preventDefault: false,
    enableOnFormTags: false,
  });
}
