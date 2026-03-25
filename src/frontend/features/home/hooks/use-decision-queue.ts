import {
  fetchDraftReplies,
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
    () => items.filter((item) => !dismissed.has(item.id)),
    [items, dismissed],
  );

  const activeItem = visibleItems[activeIndex] ?? null;

  // Pre-populate drafts from cached values and fetch missing ones
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
        (item.type === "action_needed" || item.type === "important")
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
        .catch(() => {
          // Drafts are best-effort — don't block the queue
        })
        .finally(() => setIsLoadingDrafts(false));
    }
  }, [items]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      setEditingId(null);
    },
    [],
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
        dismiss(id);
        toast.success("Archived");
      } catch {
        toast.error("Failed to archive");
      }
    },
    [items, dismiss, queryClient],
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
        dismiss(id);
        toast.success(`Reply sent to ${item.title}`);
      } catch {
        toast.error("Failed to send reply");
      } finally {
        setSendingId(null);
      }
    },
    [items, drafts, dismiss, queryClient],
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
  };
}
