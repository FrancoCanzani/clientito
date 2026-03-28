import { approveProposedEvent } from "@/features/calendar/mutations";
import {
  fetchDraftReplies,
  postBriefingDecision,
  type HomeBriefingItem,
} from "@/features/home/queries";
import { patchEmail, sendEmail } from "@/features/inbox/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export function useDecisionQueue(items: HomeBriefingItem[]) {
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const visibleItems = useMemo(
    () => items.filter((item) => item.type !== "calendar_event" && !dismissed.has(item.id)),
    [items, dismissed],
  );

  const activeItem = visibleItems[activeIndex] ?? null;

  useEffect(() => {
    if (items.length === 0 || fetchedRef.current) return;
    fetchedRef.current = true;

    const initial: Record<string, string> = {};
    const missingIds: number[] = [];

    for (const item of items) {
      if (item.draftReply) {
        initial[item.id] = item.draftReply;
      } else if (
        item.emailId &&
        item.type === "action_needed"
      ) {
        missingIds.push(item.emailId);
      }
    }

    setDrafts(initial);

    if (missingIds.length > 0) {
      setIsLoadingDrafts(true);
      fetchDraftReplies(missingIds)
        .then((result) => {
          setDrafts((prev) => {
            const next = { ...prev };
            for (const item of items) {
              if (item.emailId && result[item.emailId]) {
                next[item.id] = result[item.emailId];
              }
            }
            return next;
          });
        })
        .catch(() => {})
        .finally(() => setIsLoadingDrafts(false));
    }
  }, [items]);

  const markDone = useCallback(
    (item: HomeBriefingItem, decision: "dismissed" | "replied" | "archived" | "approved") => {
      setDismissed((prev) => new Set(prev).add(item.id));
      setEditingId(null);
      let ref: { itemType: "email" | "task" | "proposed_event"; referenceId: number } | null = null;
      if (item.proposedEventId) {
        ref = { itemType: "proposed_event", referenceId: item.proposedEventId };
      } else if (item.emailId) {
        ref = { itemType: "email", referenceId: item.emailId };
      } else {
        const match = item.id.match(/^(?:overdue|today)-(\d+)$/);
        if (match) ref = { itemType: "task", referenceId: Number(match[1]) };
      }
      if (ref) postBriefingDecision({ ...ref, decision }).catch(() => {});
    },
    [],
  );

  const dismiss = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      markDone(item, "dismissed");
    },
    [items, markDone],
  );

  const navigateUp = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const navigateDown = useCallback(() => {
    setActiveIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
  }, [visibleItems.length]);

  const updateDraft = useCallback((id: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [id]: text }));
  }, []);

  const toggleEditing = useCallback(() => {
    if (!activeItem) return;
    if (!drafts[activeItem.id]) return;
    setEditingId((prev) => (prev === activeItem.id ? null : activeItem.id));
  }, [activeItem, drafts]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
  }, []);

  const archiveItem = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item?.emailId) return;
      try {
        await patchEmail(String(item.emailId), {
          archived: true,
          isRead: true,
        });
        queryClient.invalidateQueries({ queryKey: ["emails"] });
        markDone(item, "archived");
        toast.success("Archived");
      } catch {
        toast.error("Failed to archive");
      }
    },
    [items, queryClient, markDone],
  );

  const approveEvent = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item?.proposedEventId) return;
      try {
        await approveProposedEvent(item.proposedEventId);
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        markDone(item, "approved");
        toast.success("Event added to calendar");
      } catch {
        toast.error("Failed to add event");
      }
    },
    [items, queryClient, markDone],
  );

  const dismissEvent = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item?.proposedEventId) return;
      try {
        markDone(item, "dismissed");
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      } catch {
        toast.error("Failed to dismiss event");
      }
    },
    [items, queryClient, markDone],
  );

  const sendReply = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      const draft = drafts[id];
      if (!item?.fromAddr || !draft) return;

      setSendingId(id);
      try {
        const subject = item.subject?.startsWith("Re:")
          ? item.subject
          : `Re: ${item.subject ?? ""}`;

        await sendEmail({
          to: item.fromAddr,
          subject,
          body: draft,
          threadId: item.threadId ?? undefined,
          inReplyTo: item.messageId ?? undefined,
          references: item.messageId ?? undefined,
          mailboxId: item.mailboxId ?? undefined,
        });

        queryClient.invalidateQueries({ queryKey: ["emails"] });
        markDone(item, "replied");
        toast.success(`Reply sent to ${item.title}`);
      } catch {
        toast.error("Failed to send reply");
      } finally {
        setSendingId(null);
      }
    },
    [items, drafts, queryClient, markDone],
  );

  return {
    visibleItems,
    activeIndex,
    activeItem,
    drafts,
    isLoadingDrafts,
    editingId,
    sendingId,
    setActiveIndex,
    navigateUp,
    navigateDown,
    dismiss,
    updateDraft,
    toggleEditing,
    cancelEditing,
    archiveItem,
    sendReply,
    approveEvent,
    dismissEvent,
  };
}
