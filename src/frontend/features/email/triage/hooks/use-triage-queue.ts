import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useTriageQueue({
  threadGroups,
  isLoading,
}: {
  threadGroups: ThreadGroup[];
  isLoading: boolean;
}) {
  const hasSeededRef = useRef(false);
  const [triageIds, setTriageIds] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => {
    if (hasSeededRef.current) return;
    if (isLoading) return;
    const next = new Set<string>();
    for (const group of threadGroups) {
      if (group.emails.some((email) => !email.isRead)) {
        next.add(group.representative.id);
      }
    }
    setTriageIds(next);
    hasSeededRef.current = true;
  }, [isLoading, threadGroups]);

  const queue = useMemo(
    () =>
      threadGroups.filter((group) => triageIds.has(group.representative.id)),
    [threadGroups, triageIds],
  );
  const currentGroup = queue[cursorIndex] ?? null;
  const current = currentGroup?.representative ?? null;
  const advance = useCallback(() => setCursorIndex((i) => i + 1), []);
  const goPrev = useCallback(
    () => setCursorIndex((i) => Math.max(0, i - 1)),
    [],
  );

  return {
    triageIds,
    queue,
    cursorIndex,
    currentGroup,
    current,
    advance,
    goPrev,
  };
}
