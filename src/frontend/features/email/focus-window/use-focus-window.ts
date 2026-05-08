import { useCallback, useEffect, useSyncExternalStore } from "react";

export const FOCUS_WINDOW_ENDED_EVENT = "petit:focus-window-ended";

export type FocusWindowState = {
 active: boolean;
 startedAt: number | null;
 endsAt: number | null;
 heldCount: number;
};

export type FocusWindowEndedDetail = {
 heldCount: number;
};

const INACTIVE: FocusWindowState = {
 active: false,
 startedAt: null,
 endsAt: null,
 heldCount: 0,
};

let state: FocusWindowState = INACTIVE;
const listeners = new Set<() => void>();

function emitChange(): void {
 for (const listener of listeners) listener();
}

function setState(next: FocusWindowState): void {
 state = next;
 emitChange();
}

function getSnapshot(): FocusWindowState {
 return state;
}

function subscribe(listener: () => void): () => void {
 listeners.add(listener);
 return () => listeners.delete(listener);
}

function dispatchEnded(heldCount: number): void {
 if (typeof window === "undefined") return;
 window.dispatchEvent(
 new CustomEvent<FocusWindowEndedDetail>(FOCUS_WINDOW_ENDED_EVENT, {
 detail: { heldCount },
 }),
 );
}

function endFocusWindow(): void {
 const previous = state;
 if (!previous.active) return;
 setState(INACTIVE);
 dispatchEnded(previous.heldCount);
}

export function recordFocusWindowHeldCount(count: number): void {
 if (!state.active) return;
 const heldCount = Math.max(state.heldCount, Math.max(0, Math.floor(count)));
 if (state.heldCount === heldCount) return;
 setState({ ...state, heldCount });
}

export function useFocusWindow() {
 const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => INACTIVE);

 useEffect(() => {
 if (!snapshot.active || !snapshot.endsAt) return;
 const remaining = snapshot.endsAt - Date.now();
 if (remaining <= 0) {
 endFocusWindow();
 return;
 }
 const timer = window.setTimeout(() => endFocusWindow(), remaining);
 return () => window.clearTimeout(timer);
 }, [snapshot.active, snapshot.endsAt]);

 const start = useCallback((durationMs?: number) => {
 const now = Date.now();
 setState({
 active: true,
 startedAt: now,
 endsAt: durationMs ? now + durationMs : null,
 heldCount: 0,
 });
 }, []);

 const stop = useCallback(() => endFocusWindow(), []);

 return { ...snapshot, start, stop };
}
