import { openCompose } from "@/features/email/inbox/components/compose/compose-events";
import type { QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

function invalidateAll(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["emails"] });
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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
          to: getOptionalString(args.to),
          subject: getOptionalString(args.subject),
          bodyHtml: getOptionalString(args.body),
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
