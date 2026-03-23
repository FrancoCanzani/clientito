import type { EmailListItem } from "@/features/inbox/types";
import { useCallback, useMemo } from "react";

export function useEmailInboxKeyboard({
  orderedIds,
  selectedEmailId,
  emailById,
  openEmail,
}: {
  orderedIds: string[];
  selectedEmailId: string | null;
  emailById: Map<string, EmailListItem>;
  openEmail: (email: EmailListItem) => void;
}) {
  const selectedIndex = useMemo(
    () => (selectedEmailId ? orderedIds.indexOf(selectedEmailId) : -1),
    [orderedIds, selectedEmailId],
  );

  const moveToIndex = useCallback(
    (index: number) => {
      const nextId = orderedIds[index];
      if (!nextId) return;
      const nextEmail = emailById.get(nextId);
      if (nextEmail) openEmail(nextEmail);
    },
    [emailById, openEmail, orderedIds],
  );

  const goToEmail = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "next") {
        const nextIndex =
          selectedIndex >= 0
            ? Math.min(selectedIndex + 1, orderedIds.length - 1)
            : 0;
        moveToIndex(nextIndex);
        return;
      }

      const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
      moveToIndex(prevIndex);
    },
    [moveToIndex, orderedIds.length, selectedIndex],
  );

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < orderedIds.length - 1;

  return { goToEmail, hasPrev, hasNext };
}
