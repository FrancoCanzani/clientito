import { useCompletion } from "@ai-sdk/react";
import { useEffect, useRef } from "react";

export function useBriefingStream(enabled = false) {
  const hasTriggered = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/briefing/stream",
    credentials: "same-origin",
    streamProtocol: "text",
  });

  useEffect(() => {
    if (!enabled || hasTriggered.current) return;
    hasTriggered.current = true;
    complete("");
  }, [enabled, complete]);

  return {
    text: completion,
    isStreaming: isLoading,
    error,
  };
}
