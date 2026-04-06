import { openCompose } from "@/features/inbox/components/compose-events";
import type { QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

function invalidateAll(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
  queryClient.invalidateQueries({ queryKey: ["emails"] });
}

export function useApprovalHandler({
  addToolApprovalResponse,
  close,
  queryClient,
}: {
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
  close: () => void;
  queryClient: QueryClient;
}) {
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

  return { handleApprove, handleDiscard };
}
