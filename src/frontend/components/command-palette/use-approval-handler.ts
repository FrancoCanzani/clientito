import { openCompose } from "@/features/inbox/components/compose-bridge";
import { useHotkey } from "@tanstack/react-hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { useCallback, useMemo } from "react";
import type { PaletteMode } from "./types";

function shouldIgnoreApprovalHotkeyTarget(target: EventTarget | null) {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element) return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest("textarea, [role='textbox']"));
}

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

  useHotkey(
    "Y",
    (event) => {
      if (
        mode !== "agent" ||
        !firstPendingApproval ||
        shouldIgnoreApprovalHotkeyTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      handleApprove(
        firstPendingApproval.id,
        firstPendingApproval.toolName,
        firstPendingApproval.args,
      );
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "N",
    (event) => {
      if (
        mode !== "agent" ||
        !firstPendingApproval ||
        shouldIgnoreApprovalHotkeyTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      handleDiscard(firstPendingApproval.id);
    },
    { preventDefault: false, stopPropagation: false },
  );

  return { handleApprove, handleDiscard };
}
