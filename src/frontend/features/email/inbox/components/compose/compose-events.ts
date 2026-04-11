import type { ComposeInitial } from "../../types";

const openComposeListeners = new Set<(initial?: ComposeInitial) => void>();
let hasPending = false;
let pendingInitial: ComposeInitial | undefined;

export function registerOpenComposeListener(
  listener: (initial?: ComposeInitial) => void,
) {
  openComposeListeners.add(listener);
  if (hasPending) {
    listener(pendingInitial);
    hasPending = false;
    pendingInitial = undefined;
  }
  return () => {
    openComposeListeners.delete(listener);
  };
}

export function openCompose(initial?: ComposeInitial) {
  if (openComposeListeners.size > 0) {
    for (const listener of openComposeListeners) {
      listener(initial);
    }
  } else {
    pendingInitial = initial;
    hasPending = true;
  }
}
