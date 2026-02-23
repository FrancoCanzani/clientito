import type { SdkInitResponse, SdkTrackEvent } from "@releaselayer/shared";
import { getItem, setItem } from "./storage";

let baseUrl = "";
let sdkKey = "";

export function configure(key: string, host?: string) {
  sdkKey = key;
  baseUrl = host ?? "";
}

export async function fetchInit(
  userId?: string,
  traits?: Record<string, unknown>
): Promise<SdkInitResponse | null> {
  const params = new URLSearchParams({ key: sdkKey });
  if (userId) params.set("uid", userId);
  if (traits) params.set("traits", JSON.stringify(traits));

  const url = `${baseUrl}/sdk/init?${params}`;
  const headers: Record<string, string> = {};

  const cachedEtag = getItem("etag");
  if (cachedEtag) {
    headers["If-None-Match"] = cachedEtag;
  }

  try {
    const res = await fetch(url, { headers });

    if (res.status === 304) {
      const cached = getItem("init_data");
      if (cached) return JSON.parse(cached) as SdkInitResponse;
      // Cache corrupted, refetch without etag
      return fetchInit(userId, traits);
    }

    if (!res.ok) {
      console.warn("[ReleaseLayer] Init failed:", res.status);
      return null;
    }

    const data = (await res.json()) as SdkInitResponse;
    const etag = res.headers.get("ETag");
    if (etag) setItem("etag", etag);
    setItem("init_data", JSON.stringify(data));

    return data;
  } catch (err) {
    console.warn("[ReleaseLayer] Init error:", err);
    // Fall back to cached data
    const cached = getItem("init_data");
    if (cached) return JSON.parse(cached) as SdkInitResponse;
    return null;
  }
}

// Event buffer
let eventBuffer: SdkTrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function trackEvent(event: SdkTrackEvent) {
  eventBuffer.push(event);

  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 5000);
  }
}

export function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventBuffer.length === 0) return;

  const events = [...eventBuffer];
  eventBuffer = [];

  const url = `${baseUrl}/sdk/track?key=${sdkKey}`;
  const body = JSON.stringify(events);

  // Try sendBeacon first (works during page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(url, blob);
    if (sent) return;
  }

  // Fallback to fetch
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Re-add events on failure
    eventBuffer.push(...events);
  });
}
