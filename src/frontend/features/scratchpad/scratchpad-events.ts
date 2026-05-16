type OpenScratchpadListener = () => void;

const listeners = new Set<OpenScratchpadListener>();

export function openScratchpad() {
  for (const listener of listeners) listener();
}

export function registerOpenScratchpadListener(listener: OpenScratchpadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
