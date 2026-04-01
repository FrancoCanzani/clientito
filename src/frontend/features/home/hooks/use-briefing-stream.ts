import { useCompletion } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

let cachedStreamText = "";

export function useBriefingStream(enabled = false) {
  const hasTriggered = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/briefing/stream",
    credentials: "same-origin",
    streamProtocol: "text",
    onFinish: (_prompt, text) => {
      cachedStreamText = text;
    },
  });

  useEffect(() => {
    if (!enabled || hasTriggered.current || cachedStreamText) return;
    hasTriggered.current = true;
    complete("");
  }, [enabled, complete]);

  const retry = useCallback(() => {
    cachedStreamText = "";
    complete("");
  }, [complete]);

  const text = completion || cachedStreamText;

  return {
    text,
    isStreaming: isLoading,
    error,
    retry,
  };
}

