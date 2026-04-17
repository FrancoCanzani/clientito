import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SelectFilter = "all" | "none" | "read" | "unread";

export function useInboxSelection(groups: ThreadGroup[], view: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastIndexRef = useRef<number | null>(null);

  useEffect(() => {
    setSelected(new Set());
    lastIndexRef.current = null;
  }, [view]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(groups.map((g) => g.representative.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [groups]);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback(
    (id: string, index: number, shift = false) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shift && lastIndexRef.current !== null) {
          const [a, b] = [lastIndexRef.current, index].sort((x, y) => x - y);
          const shouldAdd = !prev.has(id);
          for (let i = a; i <= b; i++) {
            const target = groups[i]?.representative.id;
            if (!target) continue;
            if (shouldAdd) next.add(target);
            else next.delete(target);
          }
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      lastIndexRef.current = index;
    },
    [groups],
  );

  const applyFilter = useCallback(
    (filter: SelectFilter) => {
      if (filter === "none") {
        setSelected(new Set());
        lastIndexRef.current = null;
        return;
      }
      const next = new Set<string>();
      for (const g of groups) {
        const email = g.representative;
        if (filter === "all") next.add(email.id);
        else if (filter === "read" && email.isRead) next.add(email.id);
        else if (filter === "unread" && !email.isRead) next.add(email.id);
      }
      setSelected(next);
      lastIndexRef.current = null;
    },
    [groups],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size > 0) return new Set();
      return new Set(groups.map((g) => g.representative.id));
    });
    lastIndexRef.current = null;
  }, [groups]);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastIndexRef.current = null;
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    applyFilter,
    clear,
    hasSelection: selected.size > 0,
  };
}
