import {
  defaultPreferences,
  preferencesSchema,
  type Preferences,
} from "@/features/settings/schema";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "petit-preferences";

function readFromStorage(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function writeToStorage(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
}

let current: Preferences =
  typeof window === "undefined" ? defaultPreferences : readFromStorage();

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return defaultPreferences;
}

export function setPreferences(patch: Partial<Preferences>) {
  const next = preferencesSchema.parse({ ...current, ...patch });
  current = next;
  writeToStorage(next);
  for (const listener of listeners) listener();
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isEveningHour(): boolean {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
}
