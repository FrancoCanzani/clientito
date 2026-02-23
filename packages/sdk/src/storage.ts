const PREFIX = "rl_";

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // localStorage unavailable or full
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function getDismissed(): Set<string> {
  const raw = getItem("dismissed");
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function addDismissed(releaseId: string): void {
  const dismissed = getDismissed();
  dismissed.add(releaseId);
  setItem("dismissed", JSON.stringify([...dismissed]));
}

export function getCompletedChecklistItems(): Set<string> {
  const raw = getItem("checklist_completed");
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function addCompletedChecklistItem(itemId: string): void {
  const completed = getCompletedChecklistItems();
  completed.add(itemId);
  setItem("checklist_completed", JSON.stringify([...completed]));
}
