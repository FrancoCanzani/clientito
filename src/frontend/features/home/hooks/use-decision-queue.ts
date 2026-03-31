import { approveProposedEvent } from "@/features/calendar/mutations";
import {
  postBriefingDecision,
  type HomeBriefingItem,
} from "@/features/home/queries";
import { patchEmail, sendEmail } from "@/features/inbox/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function useDecisionQueue(items: HomeBriefingItem[]) {
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((item) => item.draftReply)
        .map((item) => [item.id, item.draftReply ?? ""]),
    ),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.type !== "calendar_event" &&
          item.type !== "briefing_email" &&
          !dismissed.has(item.id),
      ),
    [items, dismissed],
  );

  const activeItem = visibleItems[activeIndex] ?? null;

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (item.draftReply && !next[item.id]) {
          next[item.id] = item.draftReply;
        }
      }
      return next;
    });
  }, [items]);

  const markDone = useCallback(
    (item: HomeBriefingItem, decision: "dismissed" | "replied" | "archived" | "approved") => {
      setDismissed((prev) => new Set(prev).add(item.id));
      setEditingId(null);
      let ref:
        | {
            itemType: "email_action" | "task" | "calendar_suggestion";
            referenceId: number;
            actionId?: string;
          }
        | null = null;
      if (item.proposedEventId) {
        ref = { itemType: "calendar_suggestion", referenceId: item.proposedEventId };
      } else if (item.emailId && item.actionId) {
        ref = {
          itemType: "email_action",
          referenceId: item.emailId,
          actionId: item.actionId,
        };
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

  const toggleEditing = useCallback(
    (id?: string) => {
      const targetId = id ?? activeItem?.id;
      if (!targetId || !drafts[targetId]) return;

      if (id) {
        const nextIndex = visibleItems.findIndex((item) => item.id === id);
        if (nextIndex >= 0) setActiveIndex(nextIndex);
      }

      setEditingId((prev) => (prev === targetId ? null : targetId));
    },
    [activeItem?.id, drafts, visibleItems],
  );

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
      const draft = drafts[id] ?? item?.draftReply ?? "";
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
    isLoadingDrafts: false,
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
