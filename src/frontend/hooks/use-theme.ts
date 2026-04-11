import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "petit-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // SSR or storage unavailable
  }
  return "system";
}

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const resolved = getResolvedTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

let listeners: Array<() => void> = [];
let currentTheme: Theme = getStoredTheme();

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return currentTheme;
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable
  }
  applyTheme(theme);
  for (const listener of listeners) {
    listener();
  }
}

// Apply on load
if (typeof window !== "undefined") {
  applyTheme(currentTheme);

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (currentTheme === "system") {
        applyTheme("system");
      }
    });
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getStoredTheme);
  const resolved = typeof window !== "undefined" ? getResolvedTheme(theme) : "light";

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved]);

  return {
    theme,
    resolved,
    setTheme,
    toggle,
  };
}
