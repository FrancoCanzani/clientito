import { useSyncExternalStore } from "react";

export type FocusedEmail = {
 id: string;
 fromAddr: string;
 fromName: string | null;
 subject: string | null;
 threadId: string | null;
 mailboxId: number | null;
};

let current: FocusedEmail | null = null;
const listeners = new Set<() => void>();

function emit() {
 for (const listener of listeners) listener();
}

export function setFocusedEmail(email: FocusedEmail | null) {
 if (current?.id === email?.id) return;
 current = email;
 emit();
}

export function clearFocusedEmail() {
 if (current === null) return;
 current = null;
 emit();
}

function subscribe(listener: () => void) {
 listeners.add(listener);
 return () => listeners.delete(listener);
}

function getSnapshot() {
 return current;
}

export function useFocusedEmail(): FocusedEmail | null {
 return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
