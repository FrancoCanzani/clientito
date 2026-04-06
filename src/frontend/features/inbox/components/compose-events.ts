import type { ComposeInitial } from "../types";

const openComposeListeners = new Set<(initial: ComposeInitial) => void>();
let pending: ComposeInitial | null = null;

export function registerOpenComposeListener(
  listener: (initial: ComposeInitial) => void,
) {
  openComposeListeners.add(listener);
  if (pending) {
    listener(pending);
    pending = null;
  }
  return () => {
    openComposeListeners.delete(listener);
  };
}

export function openCompose(initial: ComposeInitial) {
  if (openComposeListeners.size > 0) {
    for (const listener of openComposeListeners) {
      listener(initial);
    }
  } else {
    pending = initial;
  }
}
