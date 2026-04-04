import { useCompletion } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

const streamCache = new Map<number, string>();

export function useBriefingStream(mailboxId: number, enabled = false) {
  const hasTriggered = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/briefing/stream",
    id: `briefing-stream-${mailboxId}`,
    credentials: "same-origin",
    streamProtocol: "text",
    onFinish: (_prompt, text) => {
      streamCache.set(mailboxId, text);
    },
  });

  useEffect(() => {
    hasTriggered.current = false;
  }, [mailboxId]);

  const cachedStreamText = streamCache.get(mailboxId) ?? "";

  useEffect(() => {
    if (!enabled || hasTriggered.current || cachedStreamText) return;
    hasTriggered.current = true;
    complete("", {
      body: { mailboxId },
    });
  }, [enabled, complete, cachedStreamText, mailboxId]);

  const retry = useCallback(() => {
    streamCache.delete(mailboxId);
    hasTriggered.current = true;
    complete("", {
      body: { mailboxId },
    });
  }, [complete, mailboxId]);

  const text = completion || cachedStreamText;

  return {
    text,
    isStreaming: isLoading,
    error,
    retry,
  };
}
