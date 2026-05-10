import { useRef } from "react";
import { useHotkeys } from "@/hooks/use-hotkeys";
import {
  getShortcutsForContexts,
  findConflicts,
} from "@/lib/shortcuts/registry";
import type {
  ShortcutContext,
  ShortcutDefinition,
  UseShortcutsOptions,
} from "@/lib/shortcuts/types";

const devWarnings = new Set<string>();

type ShortcutHandler =
  | ((event: KeyboardEvent, def: ShortcutDefinition) => void)
  | {
      action: (event: KeyboardEvent, def: ShortcutDefinition) => void;
      enabled?: boolean;
    };

function normalizeHandler(
  handler: ShortcutHandler,
): {
  action: (event: KeyboardEvent, def: ShortcutDefinition) => void;
  enabled?: boolean;
} {
  if (typeof handler === "function") {
    return { action: handler };
  }
  return handler;
}

export function useShortcuts(
  context: ShortcutContext,
  handlers: Record<string, ShortcutHandler>,
  options: UseShortcutsOptions = {},
) {
  const { enabled = true, target, allowInEditable } = options;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  if (import.meta.env.DEV) {
    const conflicts = findConflicts();
    for (const [a, b] of conflicts) {
      const key = `conflict:${a.id}:${b.id}`;
      if (!devWarnings.has(key)) {
        devWarnings.add(key);
        console.warn(
          `[shortcuts] CONFLICT: "${a.id}" and "${b.id}" both use key "${a.key}" in overlapping contexts`,
        );
      }
    }

    if (context !== "global") {
      const defs = getShortcutsForContexts([context, "global"]);
      for (const def of defs) {
        if (def.contexts.includes(context) && !handlers[def.id]) {
          const key = `missing:${context}:${def.id}`;
          if (!devWarnings.has(key)) {
            devWarnings.add(key);
            console.warn(
              `[shortcuts] Missing handler for "${def.id}" (${def.key}) in context "${context}"`,
            );
          }
        }
      }
    }

    const defs = getShortcutsForContexts([context, "global"]);
    for (const id of Object.keys(handlers)) {
      const def = defs.find((d) => d.id === id);
      if (!def) {
        const key = `unknown:${context}:${id}`;
        if (!devWarnings.has(key)) {
          devWarnings.add(key);
          console.warn(
            `[shortcuts] Handler registered for unknown shortcut id "${id}" in context "${context}"`,
          );
        }
      }
    }
  }

  const defs = getShortcutsForContexts([context, "global"]);
  const bindings: Record<
    string,
    { onKeyDown: (e: KeyboardEvent) => void; enabled?: boolean; allowInEditable?: boolean; preventDefault?: boolean }
  > = {};

  for (const def of defs) {
    const handler = handlers[def.id];
    if (!handler) continue;

    const { action: _action, enabled: bindingEnabled } = normalizeHandler(handler);

    bindings[def.key] = {
      onKeyDown: (event: KeyboardEvent) => {
        const currentHandler = handlersRef.current[def.id];
        if (!currentHandler) return;
        const { action } = normalizeHandler(currentHandler);
        action(event, def);
      },
      enabled: enabled && bindingEnabled !== false,
      allowInEditable: def.allowInEditable,
      preventDefault: def.preventDefault !== false,
    };
  }

  useHotkeys(bindings, { enabled, target, allowInEditable });
}
