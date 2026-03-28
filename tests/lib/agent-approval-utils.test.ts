import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { discardPendingApprovalParts } from "../../src/frontend/components/command-palette/agent-approval-utils";

describe("discardPendingApprovalParts", () => {
  it("converts approval-requested tool parts into output-denied", () => {
    const messages: UIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "text", text: "Want me to archive this?" },
          {
            type: "tool-archiveEmail",
            toolCallId: "call_123",
            toolName: "archiveEmail",
            state: "approval-requested",
            input: { emailId: 42 },
            approval: { id: "approval_123" },
          },
        ],
      },
    ];

    const updated = discardPendingApprovalParts(messages);
    const toolPart = updated[0].parts[1];

    expect(toolPart).toMatchObject({
      state: "output-denied",
      approval: {
        id: "approval_123",
        approved: false,
      },
    });
  });

  it("leaves non-pending tool parts unchanged", () => {
    const messages: UIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-searchEmails",
            toolCallId: "call_456",
            toolName: "searchEmails",
            state: "output-available",
            input: { query: "checkly" },
            output: { count: 1 },
          },
        ],
      },
    ];

    expect(discardPendingApprovalParts(messages)).toEqual(messages);
  });
});
