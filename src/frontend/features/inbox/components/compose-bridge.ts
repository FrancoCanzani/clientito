import type { Editor } from "@tiptap/core";
import type { ComposeInitial } from "../types";

const openComposeListeners = new Set<(initial: ComposeInitial) => void>();

export function registerComposeEditor(_editor?: Editor) {}

export function unregisterComposeEditor() {}

export function registerOpenComposeListener(
  listener: (initial: ComposeInitial) => void,
) {
  openComposeListeners.add(listener);
  return () => {
    openComposeListeners.delete(listener);
  };
}

export function openCompose(initial: ComposeInitial) {
  for (const listener of openComposeListeners) {
    listener(initial);
  }
}
