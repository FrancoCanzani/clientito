import { authClient } from "@/lib/auth-client";

const USER_CACHE_TTL_MS = 15_000;

let cachedUserId: string | null | undefined;
let cachedAt = 0;
let inFlight: Promise<string | null> | null = null;

export async function getCurrentUserId(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const now = Date.now();
  if (cachedUserId !== undefined && now - cachedAt < USER_CACHE_TTL_MS) {
    return cachedUserId;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = authClient
    .getSession()
    .then((session) => {
      cachedUserId = session.data?.user?.id ?? null;
      cachedAt = Date.now();
      return cachedUserId;
    })
    .catch(() => {
      cachedUserId = null;
      cachedAt = Date.now();
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function resetCurrentUserCache() {
  cachedUserId = undefined;
  cachedAt = 0;
  inFlight = null;
}
