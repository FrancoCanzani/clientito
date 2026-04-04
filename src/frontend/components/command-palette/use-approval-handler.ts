import { openCompose } from "@/features/inbox/components/compose-bridge";
import { shouldIgnoreHotkeyTarget } from "@/lib/hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { useCallback, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { PaletteMode } from "./types";

function invalidateAll(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
  queryClient.invalidateQueries({ queryKey: ["emails"] });
}

export function useApprovalHandler({
  messages,
  mode,
  addToolApprovalResponse,
  close,
  queryClient,
}: {
  messages: UIMessage[];
  mode: PaletteMode;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
  close: () => void;
  queryClient: QueryClient;
}) {
  const firstPendingApproval = useMemo(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (isToolUIPart(part) && part.state === "approval-requested") {
          return {
            id: part.approval.id,
            toolName: getToolName(part),
            args: part.input as Record<string, unknown>,
          };
        }
      }
    }
    return null;
  }, [messages]);

  const handleApprove = useCallback(
    (
      toolCallId: string,
      toolName?: string,
      args?: Record<string, unknown>,
    ) => {
      addToolApprovalResponse({ id: toolCallId, approved: true });
      invalidateAll(queryClient);

      if (toolName === "composeEmail" && args) {
        openCompose({
          mailboxId:
            typeof args.mailboxId === "number" ? args.mailboxId : undefined,
          to: args.to as string | undefined,
          subject: args.subject as string | undefined,
          bodyHtml: args.body as string | undefined,
        });
        close();
      }
    },
    [addToolApprovalResponse, close, queryClient],
  );

  const handleDiscard = useCallback(
    (toolCallId: string) => {
      addToolApprovalResponse({ id: toolCallId, approved: false });
    },
    [addToolApprovalResponse],
  );

  const enabled = mode === "agent" && !!firstPendingApproval;

  useHotkeys(
    "y",
    (event) => {
      if (!firstPendingApproval || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      handleApprove(
        firstPendingApproval.id,
        firstPendingApproval.toolName,
        firstPendingApproval.args,
      );
    },
    { enabled, enableOnFormTags: false },
    [handleApprove, firstPendingApproval],
  );

  useHotkeys(
    "n",
    (event) => {
      if (!firstPendingApproval || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      handleDiscard(firstPendingApproval.id);
    },
    { enabled, enableOnFormTags: false },
    [handleDiscard, firstPendingApproval],
  );

  return { handleApprove, handleDiscard };
}
