import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "compose-draft:";
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type DraftState = {
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  forwardedContent?: string;
};

type StoredDraft = DraftState & { savedAt: number };

function getStorageKey(composeKey: string): string {
  return STORAGE_PREFIX + (composeKey || "new");
}

function load(key: string): DraftState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: StoredDraft = JSON.parse(raw);
    if (Date.now() - (parsed.savedAt ?? 0) > EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }
    const { savedAt: _, ...draft } = parsed;
    return draft;
  } catch {
    return null;
  }
}

function save(key: string, draft: DraftState): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {}
}

function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function isDraftEmpty(d: DraftState): boolean {
  return (
    !d.to &&
    !d.cc &&
    !d.bcc &&
    !d.subject &&
    (!d.body || d.body === "<p></p>" || d.body === "<p><br></p>") &&
    !d.forwardedContent
  );
}

export function useLocalDraft(composeKey: string, draft: DraftState) {
  const storageKey = getStorageKey(composeKey);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const timer = setTimeout(() => {
      const d = draftRef.current;
      if (isDraftEmpty(d)) {
        clear(storageKey);
      } else {
        save(storageKey, d);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, storageKey]);

  return {
    clearDraft: () => clear(storageKey),
  };
}

useLocalDraft.load = function loadDraft(composeKey: string): DraftState | null {
  return load(getStorageKey(composeKey));
};
