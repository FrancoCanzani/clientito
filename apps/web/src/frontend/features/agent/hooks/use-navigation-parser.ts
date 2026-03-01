import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { parseNavigationBlock } from "../lib/parse-navigation";

export function useNavigationParser(messages: UIMessage[]) {
  const navigate = useNavigate();
  const lastProcessedId = useRef<string | null>(null);

  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastAssistant) return;
    if (lastAssistant.id === lastProcessedId.current) return;

    const text =
      lastAssistant.parts
        ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";

    const command = parseNavigationBlock(text);
    if (!command) return;

    lastProcessedId.current = lastAssistant.id;

    const searchParams: Record<string, string> = {};
    if (command.params) {
      for (const [key, value] of Object.entries(command.params)) {
        if (value) searchParams[key] = value;
      }
    }

    navigate({
      to: command.path,
      search: Object.keys(searchParams).length > 0 ? searchParams : undefined,
    });
  }, [messages, navigate]);
}
