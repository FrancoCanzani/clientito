import type { DecodedCursor } from "./types";

export function encodeViewCursor(cursor: DecodedCursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeViewCursor(
  cursor: string | undefined,
): DecodedCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(atob(cursor)) as DecodedCursor;
  } catch {
    return null;
  }
}
