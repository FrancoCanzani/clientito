const CONTENT_KEY = "petit:scratchpad:content";
const WINDOW_KEY = "petit:scratchpad:window";

export type ScratchpadWindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_SCRATCHPAD_WINDOW: ScratchpadWindowState = {
  x: 48,
  y: 48,
  width: 440,
  height: 320,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadScratchpadContent(): string {
  if (!canUseStorage()) return "<p></p>";
  return window.localStorage.getItem(CONTENT_KEY) ?? "<p></p>";
}

export function saveScratchpadContent(content: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(CONTENT_KEY, content);
}

export function loadScratchpadWindowState(): ScratchpadWindowState {
  if (!canUseStorage()) return DEFAULT_SCRATCHPAD_WINDOW;
  const raw = window.localStorage.getItem(WINDOW_KEY);
  if (!raw) return DEFAULT_SCRATCHPAD_WINDOW;

  try {
    const parsed = JSON.parse(raw) as Partial<ScratchpadWindowState>;
    const { x, y, width, height } = parsed;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof height !== "number"
    ) {
      return DEFAULT_SCRATCHPAD_WINDOW;
    }
    return { x, y, width, height };
  } catch {
    return DEFAULT_SCRATCHPAD_WINDOW;
  }
}

export function saveScratchpadWindowState(state: ScratchpadWindowState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(WINDOW_KEY, JSON.stringify(state));
}
