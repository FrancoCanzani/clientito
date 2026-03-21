import type { EmailInboxAction } from "@/features/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/inbox/types";
import { shouldIgnoreHotkeyTarget } from "@/lib/hotkeys";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useMemo } from "react";

export function useEmailInboxKeyboard({
  orderedIds,
  selectedEmailId,
  emailById,
  openEmail,
  closeEmail,
  executeEmailAction,
}: {
  orderedIds: string[];
  selectedEmailId: string | null;
  emailById: Map<string, EmailListItem>;
  openEmail: (email: EmailListItem) => void;
  closeEmail: () => void;
  executeEmailAction: (action: EmailInboxAction, explicitIds?: string[]) => void;
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
      moveToIndex(direction === "next" ? selectedIndex + 1 : selectedIndex - 1);
    },
    [moveToIndex, selectedIndex],
  );

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < orderedIds.length - 1;

  const guardedMove = useCallback(
    (event: KeyboardEvent, getIndex: () => number) => {
      if (shouldIgnoreHotkeyTarget(event.target) || orderedIds.length === 0) return;
      event.preventDefault();
      moveToIndex(getIndex());
    },
    [moveToIndex, orderedIds.length],
  );

  const nextIndex = useCallback(
    () =>
      selectedIndex >= 0
        ? Math.min(selectedIndex + 1, orderedIds.length - 1)
        : 0,
    [selectedIndex, orderedIds.length],
  );

  const prevIndex = useCallback(
    () => (selectedIndex > 0 ? selectedIndex - 1 : 0),
    [selectedIndex],
  );

  useHotkey("ArrowDown", (e) => guardedMove(e, nextIndex), { preventDefault: false, stopPropagation: false });
  useHotkey("J", (e) => guardedMove(e, nextIndex), { preventDefault: false, stopPropagation: false });
  useHotkey("ArrowUp", (e) => guardedMove(e, prevIndex), { preventDefault: false, stopPropagation: false });
  useHotkey("K", (e) => guardedMove(e, prevIndex), { preventDefault: false, stopPropagation: false });

  useHotkey(
    "Enter",
    (event) => {
      if (shouldIgnoreHotkeyTarget(event.target) || selectedIndex !== -1 || orderedIds.length === 0) return;
      event.preventDefault();
      moveToIndex(0);
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "Escape",
    (event) => {
      if (shouldIgnoreHotkeyTarget(event.target) || !selectedEmailId) return;
      event.preventDefault();
      closeEmail();
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "E",
    (event) => {
      if (shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      executeEmailAction("archive");
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    { key: "#", shift: true, alt: false, ctrl: false, meta: false },
    (event) => {
      if (shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      executeEmailAction("trash");
    },
    { preventDefault: false, stopPropagation: false },
  );

  return { goToEmail, hasPrev, hasNext };
}
