import {
  AgentMessage,
  AgentThinking,
  ToolApprovalCard,
} from "@/components/agent-message";
import { Button } from "@/components/ui/button";
import type { UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { getAgentStatusLabel } from "./types";

export function AgentPanel({
  messages,
  status,
  isConnected,
  hasPendingApprovals,
  agentHasSubmitted,
  agentSuggestions,
  messagesViewportRef,
  submitAgentMessage,
  startFreshChat,
  handleApprove,
  handleDiscard,
}: {
  messages: UIMessage[];
  status: "ready" | "streaming" | "submitted" | "error";
  isConnected: boolean;
  hasPendingApprovals: boolean;
  agentHasSubmitted: boolean;
  agentSuggestions: string[];
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  submitAgentMessage: (text: string) => void;
  startFreshChat: () => void;
  handleApprove: (
    toolCallId: string,
    toolName?: string,
    args?: Record<string, unknown>,
  ) => void;
  handleDiscard: (toolCallId: string) => void;
}) {
  const agentStatusLabel = getAgentStatusLabel(status, isConnected);

  return (
    <div className="flex h-96 flex-col md:h-116">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 p-2.5">
        <div className="min-w-0">
          <p className="font-medium text-sm">Agent</p>
          {agentStatusLabel ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {agentStatusLabel}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="xs" variant={"outline"} onClick={startFreshChat}>
            New chat
          </Button>
        </div>
      </div>

      <div ref={messagesViewportRef} className="flex-1 overflow-y-auto py-2">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id}>
              <AgentMessage message={message} />
              {message.parts
                .filter(
                  (part) =>
                    isToolUIPart(part) &&
                    part.state === "approval-requested",
                )
                .map((part) => {
                  return (
                    <ToolApprovalCard
                      key={part.toolCallId}
                      toolCallId={part.approval.id}
                      toolName={getToolName(part)}
                      args={part.input as Record<string, unknown>}
                      onApprove={(id) =>
                        handleApprove(
                          id,
                          getToolName(part),
                          part.input as Record<string, unknown>,
                        )
                      }
                      onDiscard={handleDiscard}
                    />
                  );
                })}
            </div>
          ))
        ) : (
          <div className="space-y-4 px-3 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ask the agent</p>
              <p className="text-xs text-muted-foreground">
                It can read context from your current page, search emails, and
                prepare actions for approval.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {agentSuggestions.map((suggestion) => (
                <Button
                  variant={"secondary"}
                  key={suggestion}
                  type="button"
                  onClick={() => submitAgentMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {(status === "streaming" || status === "submitted") && (
          <AgentThinking label={"Working on it..."} />
        )}
        {hasPendingApprovals && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Resolve the pending action before sending another message.
          </p>
        )}
        {status === "error" && messages.length === 0 && agentHasSubmitted && (
          <p className="px-3 py-2 text-xs text-destructive">
            The agent hit an error. Try asking again.
          </p>
        )}
      </div>
    </div>
  );
}
