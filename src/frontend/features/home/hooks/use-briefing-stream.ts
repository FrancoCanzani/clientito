import { useCompletion } from "@ai-sdk/react";
import { useCallback, useRef } from "react";

export function useBriefingStream() {
  const hasTriggered = useRef(false);

  const { completion, isLoading, error, complete } = useCompletion({
    api: "/api/ai/briefing/stream",
    credentials: "same-origin",
    streamProtocol: "text",
  });

  const trigger = useCallback(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    complete("");
  }, [complete]);

  return {
    text: completion,
    isStreaming: isLoading,
    error,
    trigger,
  };
}
