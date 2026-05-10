import type { DecodedCursor } from "./types";

export function encodeViewCursor(
  cursor: DecodedCursor,
  beforeMs?: number,
): string {
  const payload =
    cursor.type === "remote" && beforeMs != null
      ? { ...cursor, beforeMs }
      : cursor;
  return btoa(JSON.stringify(payload));
}

export function decodeViewCursor(
  cursor: string | undefined,
): { cursor: DecodedCursor | null; beforeMs?: number } {
  if (!cursor) return { cursor: null };
  try {
    const raw = JSON.parse(atob(cursor)) as Record<string, unknown>;
    const beforeMs =
      typeof raw.beforeMs === "number" ? raw.beforeMs : undefined;
    const { beforeMs: _, ...cursorData } = raw;
    return {
      cursor: cursorData as DecodedCursor,
      beforeMs,
    };
  } catch {
    return { cursor: null };
  }
}