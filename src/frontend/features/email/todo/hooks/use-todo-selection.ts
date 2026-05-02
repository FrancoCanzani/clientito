import { useEffect, useMemo, useState } from "react";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";

export function useTodoSelection(groups: ThreadGroup[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedId(null);
      return;
    }

    if (
      !selectedId ||
      !groups.some((group) => group.representative.id === selectedId)
    ) {
      const firstGroup = groups[0];
      setSelectedId(firstGroup?.representative.id ?? null);
    }
  }, [groups, selectedId]);

  const selectedGroup = useMemo(() => {
    if (groups.length === 0) return null;
    if (!selectedId) return groups[0] ?? null;
    return (
      groups.find((group) => group.representative.id === selectedId) ??
      groups[0] ??
      null
    );
  }, [groups, selectedId]);

  return {
    selectedId,
    setSelectedId,
    selectedGroup,
    selectedEmail: selectedGroup?.representative ?? null,
  };
}
