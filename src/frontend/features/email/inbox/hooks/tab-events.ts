const listeners = new Set<(emailId: string) => void>();
let pending: string | null = null;

export function emitOpenInTab(emailId: string) {
  if (listeners.size === 0) {
    pending = emailId;
    return;
  }
  for (const listener of listeners) listener(emailId);
}

export function subscribeOpenInTab(listener: (emailId: string) => void) {
  listeners.add(listener);
  if (pending) {
    const id = pending;
    pending = null;
    listener(id);
  }
  return () => {
    listeners.delete(listener);
  };
}
