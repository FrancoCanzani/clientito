import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useAuth } from "./use-auth";
import { usePageContext } from "./use-page-context";

export function useAppAgent() {
  const { user } = useAuth();
  const pageContext = usePageContext();

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
      pageContext,
    }),
  });

  return {
    ...chat,
    isConnected: agent.readyState === WebSocket.OPEN,
  };
}
