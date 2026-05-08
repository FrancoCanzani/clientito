import { useEffect, useMemo, useRef, useState } from "react";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";

function isDesktopViewport(): boolean {
 if (typeof window === "undefined") return false;
 return window.matchMedia("(min-width: 768px)").matches;
}

export function useTodoSelection(groups: ThreadGroup[]) {
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const didInitialSelectRef = useRef(false);

 useEffect(() => {
 if (groups.length === 0) {
 if (selectedId !== null) setSelectedId(null);
 didInitialSelectRef.current = false;
 return;
 }

 // If current selection was removed from the queue (archived/done), fall back.
 if (
 selectedId &&
 !groups.some((group) => group.representative.id === selectedId)
 ) {
 setSelectedId(groups[0]?.representative.id ?? null);
 return;
 }

 // First load on desktop: auto-pick the first item so the reader isn't blank.
 // On mobile we keep the queue in focus until the user taps a row.
 if (
 !didInitialSelectRef.current &&
 selectedId === null &&
 isDesktopViewport()
 ) {
 didInitialSelectRef.current = true;
 setSelectedId(groups[0]?.representative.id ?? null);
 }
 }, [groups, selectedId]);

 const selectedGroup = useMemo(() => {
 if (!selectedId) return null;
 return (
 groups.find((group) => group.representative.id === selectedId) ?? null
 );
 }, [groups, selectedId]);

 return {
 selectedId,
 setSelectedId,
 selectedGroup,
 selectedEmail: selectedGroup?.representative ?? null,
 };
}
