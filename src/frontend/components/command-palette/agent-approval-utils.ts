import { isToolUIPart, type UIMessage } from "ai";

export function discardPendingApprovalParts(
  messages: UIMessage[],
  reason = "User continued the conversation instead of approving this action.",
): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (!isToolUIPart(part) || part.state !== "approval-requested") {
        return part;
      }

      return {
        ...part,
        state: "output-denied" as const,
        approval: {
          ...part.approval,
          approved: false,
          reason,
        },
      };
    }),
  }));
}
