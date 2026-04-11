import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { getComposerBody, isComposerOpen } from "@/features/email/inbox/components/compose/compose-editor-ref";
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
    body: () => {
      const composerBody = isComposerOpen() ? getComposerBody() : null;
      const ctxWithComposer = pageContext
        ? { ...pageContext, composer: composerBody ? { body: composerBody } : null }
        : pageContext;
      return {
        currentUrl:
          typeof window !== "undefined" ? window.location.href : null,
        pageContext: ctxWithComposer,
      };
    },
  });

  return {
    ...chat,
    isConnected: agent.readyState === WebSocket.OPEN,
  };
}
