import { useCallback, useMemo, useState } from "react";
import type { EmailListItem } from "../types";

export type EmailSelection = {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectRange: (fromId: string, toId: string) => void;
  isSelected: (id: string) => boolean;
  count: number;
  hasSelection: boolean;
};

export function useEmailSelection(displayEmails: EmailListItem[]) {
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleIds = useMemo(
    () => new Set(displayEmails.map((email) => email.id)),
    [displayEmails],
  );
  const selectedIds = useMemo(
    () =>
      new Set(
        Array.from(rawSelectedIds).filter((emailId) => visibleIds.has(emailId)),
      ),
    [rawSelectedIds, visibleIds],
  );

  const toggle = useCallback((id: string) => {
    setRawSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setRawSelectedIds(new Set(displayEmails.map((email) => email.id)));
  }, [displayEmails]);

  const deselectAll = useCallback(() => {
    setRawSelectedIds(new Set());
  }, []);

  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = displayEmails.findIndex((email) => email.id === fromId);
      const toIndex = displayEmails.findIndex((email) => email.id === toId);

      if (fromIndex === -1 || toIndex === -1) {
        return;
      }

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = displayEmails
        .slice(start, end + 1)
        .map((email) => email.id);

      setRawSelectedIds((current) => new Set([...current, ...rangeIds]));
    },
    [displayEmails],
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const count = selectedIds.size;
  const hasSelection = count > 0;

  return useMemo<EmailSelection>(
    () => ({
      selectedIds,
      toggle,
      selectAll,
      deselectAll,
      selectRange,
      isSelected,
      count,
      hasSelection,
    }),
    [
      count,
      deselectAll,
      hasSelection,
      isSelected,
      selectAll,
      selectRange,
      selectedIds,
      toggle,
    ],
  );
}
