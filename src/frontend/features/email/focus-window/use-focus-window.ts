import { useCallback, useEffect, useSyncExternalStore } from "react";

export const FOCUS_WINDOW_ENDED_EVENT = "petit:focus-window-ended";
const FOCUS_WINDOW_STORAGE_KEY = "petit:focus-window-state:v1";

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
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function clampHeldCount(value: unknown): number {
 if (typeof value !== "number" || !Number.isFinite(value)) return 0;
 return Math.max(0, Math.floor(value));
}

function readStoredState(): FocusWindowState {
 if (typeof window === "undefined") return INACTIVE;
 try {
 const raw = window.localStorage.getItem(FOCUS_WINDOW_STORAGE_KEY);
 if (!raw) return INACTIVE;
 const parsed = JSON.parse(raw) as Partial<FocusWindowState> | null;
 if (!parsed || typeof parsed !== "object") return INACTIVE;
 if (parsed.active !== true) return INACTIVE;

 const startedAt =
 typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)
 ? parsed.startedAt
 : null;
 const endsAt =
 typeof parsed.endsAt === "number" && Number.isFinite(parsed.endsAt)
 ? parsed.endsAt
 : null;

 if (endsAt != null && endsAt <= Date.now()) return INACTIVE;

 return {
 active: true,
 startedAt,
 endsAt,
 heldCount: clampHeldCount(parsed.heldCount),
 };
 } catch {
 return INACTIVE;
 }
}

function persistState(next: FocusWindowState): void {
 if (typeof window === "undefined") return;
 try {
 if (!next.active) {
 window.localStorage.removeItem(FOCUS_WINDOW_STORAGE_KEY);
 return;
 }
 window.localStorage.setItem(FOCUS_WINDOW_STORAGE_KEY, JSON.stringify(next));
 } catch {
 // Ignore storage failures (privacy mode, full quota, etc).
 }
}

function emitChange(): void {
 for (const listener of listeners) listener();
}

function setState(next: FocusWindowState): void {
 state = next;
 persistState(next);
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
 if (hydratedFromStorage) return;
 hydratedFromStorage = true;
 // Do not overwrite a session that started before hydration runs.
 if (state.active) return;
 setState(readStoredState());
 }, []);

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
