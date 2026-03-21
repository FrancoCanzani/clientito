import { useSyncExternalStore, useCallback, useMemo } from "react";
import type { EmailListItem } from "../types";

type SelectionState = {
  selectedIds: Set<string>;
  selectionMode: boolean;
  lastClickedId: string | null;
};

let state: SelectionState = {
  selectedIds: new Set(),
  selectionMode: false,
  lastClickedId: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<SelectionState>) {
  state = { ...state, ...next };
  emit();
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectionStore(displayRows: EmailListItem[]) {
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  const visibleIds = useMemo(
    () => new Set(displayRows.map((e) => e.id)),
    [displayRows],
  );

  const selectedIds = useMemo(
    () => new Set(Array.from(snap.selectedIds).filter((id) => visibleIds.has(id))),
    [snap.selectedIds, visibleIds],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setState({ selectedIds: next });
    },
    [],
  );

  const selectAll = useCallback(() => {
    setState({
      selectedIds: new Set(displayRows.map((e) => e.id)),
      selectionMode: true,
    });
  }, [displayRows]);

  const deselectAll = useCallback(() => {
    setState({ selectedIds: new Set() });
  }, []);

  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIdx = displayRows.findIndex((e) => e.id === fromId);
      const toIdx = displayRows.findIndex((e) => e.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const rangeIds = displayRows.slice(start, end + 1).map((e) => e.id);
      setState({ selectedIds: new Set([...state.selectedIds, ...rangeIds]) });
    },
    [displayRows],
  );

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const clearSelection = useCallback(() => {
    setState({ selectedIds: new Set(), selectionMode: false });
  }, []);

  const toggleSelection = useCallback(
    (emailId: string, shiftKey: boolean) => {
      setState({ selectionMode: true });
      if (shiftKey && state.lastClickedId) {
        selectRange(state.lastClickedId, emailId);
      } else {
        toggle(emailId);
      }
      setState({ lastClickedId: emailId });
    },
    [selectRange, toggle],
  );

  const toggleSelectionFromMenu = useCallback(
    (emailId: string) => {
      setState({ selectionMode: true });
      toggle(emailId);
      setState({ lastClickedId: emailId });
    },
    [toggle],
  );

  const count = selectedIds.size;

  return {
    selectedIds,
    selectionMode: snap.selectionMode,
    setSelectionMode: (v: boolean) => setState({ selectionMode: v }),
    count,
    hasSelection: count > 0,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    selectRange,
    clearSelection,
    toggleSelection,
    toggleSelectionFromMenu,
  };
}
