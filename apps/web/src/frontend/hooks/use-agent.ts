import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useAuth } from "./use-auth";

export function useAppAgent() {
  const { user } = useAuth();

  const agent = useAgent({
    agent: "Agent",
    name: user?.id ?? "anonymous",
  });

  const chat = useAgentChat({
    agent,
    body: () => ({
      userId: user?.id ?? null,
      currentUrl:
        typeof window !== "undefined" ? window.location.href : null,
    }),
  });

  return {
    ...chat,
    isConnected: agent.readyState === WebSocket.OPEN,
  };
}
