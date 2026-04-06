import { useCallback, useEffect, useState } from "react";

const streamCache = new Map<number, string>();
const streamInFlight = new Map<number, Promise<string>>();

function requestBriefing(mailboxId: number): Promise<string> {
  const inFlight = streamInFlight.get(mailboxId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const response = await fetch("/api/ai/briefing/stream", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mailboxId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to load briefing (${response.status})`);
    }

    return (await response.text()).trim();
  })().finally(() => {
    streamInFlight.delete(mailboxId);
  });

  streamInFlight.set(mailboxId, request);
  return request;
}

export function useBriefingStream(mailboxId: number) {
  const [text, setText] = useState(streamCache.get(mailboxId) ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = streamCache.get(mailboxId);
    if (cached) {
      setText(cached);
      setIsStreaming(false);
      setError(null);
      return;
    }

    setText("");
    setIsStreaming(true);
    setError(null);

    void requestBriefing(mailboxId)
      .then((next) => {
        if (cancelled) return;
        if (next) {
          streamCache.set(mailboxId, next);
          setText(next);
        }
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError : new Error("Failed to load briefing"));
      })
      .finally(() => {
        if (cancelled) return;
        setIsStreaming(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mailboxId]);

  const retry = useCallback(() => {
    streamCache.delete(mailboxId);
    streamInFlight.delete(mailboxId);
    setText("");
    setIsStreaming(true);
    setError(null);

    void requestBriefing(mailboxId)
      .then((next) => {
        if (next) {
          streamCache.set(mailboxId, next);
          setText(next);
        }
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError : new Error("Failed to load briefing"));
      })
      .finally(() => {
        setIsStreaming(false);
      });
  }, [mailboxId]);

  return {
    text,
    isStreaming,
    error,
    retry,
  };
}
