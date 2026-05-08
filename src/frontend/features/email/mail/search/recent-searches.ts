const STORAGE_KEY = "duomo:recent-searches";
const MAX_RECENT = 5;

export function readRecentSearches(): string[] {
 if (typeof window === "undefined") return [];
 try {
 const raw = window.localStorage.getItem(STORAGE_KEY);
 if (!raw) return [];
 const parsed = JSON.parse(raw);
 if (!Array.isArray(parsed)) return [];
 return parsed
 .filter((entry): entry is string => typeof entry === "string")
 .slice(0, MAX_RECENT);
 } catch {
 return [];
 }
}

export function pushRecentSearch(query: string): string[] {
 if (typeof window === "undefined") return [];
 const trimmed = query.trim();
 if (trimmed.length < 2) return readRecentSearches();
 const current = readRecentSearches().filter(
 (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
 );
 const next = [trimmed, ...current].slice(0, MAX_RECENT);
 try {
 window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
 } catch {
 // Persistence is best-effort.
 }
 return next;
}

export function clearRecentSearches(): void {
 if (typeof window === "undefined") return;
 try {
 window.localStorage.removeItem(STORAGE_KEY);
 } catch {
 // Best-effort.
 }
}
