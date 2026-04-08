import { useCallback } from "react";

export function useEmailAiActions({
  onReplyRequested,
}: {
  onReplyRequested: (draft?: string) => void;
}) {
  const handleReply = useCallback(
    (draft?: string) => onReplyRequested(draft),
    [onReplyRequested],
  );

  return {
    handleReply,
  };
}
