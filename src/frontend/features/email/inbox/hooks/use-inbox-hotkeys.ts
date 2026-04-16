import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import type { EmailListItem } from "@/features/email/inbox/types";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import {
  setFocusedEmail,
  clearFocusedEmail,
} from "@/hooks/use-focused-email";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type InboxHotkeysOptions = {
  groups: ThreadGroup[];
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  onCompose: () => void;
  onSearch: () => void;
  onFocusChange?: (emailId: string | null) => void;
};

export function useInboxHotkeys({
  groups,
  onOpen,
  view,
  onAction,
  onCompose,
  onSearch,
  onFocusChange,
}: InboxHotkeysOptions) {
  const queryClient = useQueryClient();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const lastIndexRef = useRef(-1);

  let focusedIndex = focusedId
    ? groups.findIndex((g) => g.representative.id === focusedId)
    : -1;

  // If the focused row vanished (archived/trashed), clamp to the previous slot
  // so the next row takes focus instead of losing it entirely.
  if (focusedId && focusedIndex === -1 && groups.length > 0) {
    focusedIndex = Math.min(lastIndexRef.current, groups.length - 1);
  }

  lastIndexRef.current = focusedIndex;
  const focusedEmail = groups[focusedIndex]?.representative ?? null;

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(next, groups.length - 1));
    const target = groups[clamped]?.representative.id ?? null;
    setFocusedId(target);
    onFocusChange?.(target);
  };

  useHotkeys({
    j: {
      enabled: groups.length > 0,
      onKeyDown: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex + 1),
    },
    k: {
      enabled: groups.length > 0,
      onKeyDown: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex - 1),
    },
    Enter: {
      enabled: Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onOpen(focusedEmail);
        }
      },
    },
    e: {
      enabled: Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onAction(
            view === "archived" || view === "trash"
              ? "move-to-inbox"
              : "archive",
            [focusedEmail.id],
          );
        }
      },
    },
    s: {
      enabled: Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          const isStarred = focusedEmail.labelIds.includes("STARRED");
          onAction(isStarred ? "unstar" : "star", [focusedEmail.id]);
        }
      },
    },
    "#": {
      enabled: Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onAction(
            view === "trash" ? "delete-forever" : "trash",
            [focusedEmail.id],
          );
        }
      },
    },
    u: {
      enabled: Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onAction(
            focusedEmail.isRead ? "mark-unread" : "mark-read",
            [focusedEmail.id],
          );
        }
      },
    },
    c: () => onCompose(),
    "/": (e) => {
      e.preventDefault();
      onSearch();
    },
  });

  // Prefetch adjacent email details for instant navigation.
  useEffect(() => {
    if (focusedIndex < 0) return;
    const neighbors = [focusedIndex - 1, focusedIndex + 1];
    for (const idx of neighbors) {
      const email = groups[idx]?.representative;
      if (!email) continue;
      const key = ["email-detail", email.id];
      if (queryClient.getQueryState(key)?.status === "success") continue;
      void queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () =>
          fetchEmailDetail(email.id, {
            mailboxId: email.mailboxId ?? undefined,
          }),
        staleTime: 45_000,
        gcTime: 120_000,
      });
    }
  }, [focusedIndex, groups, queryClient]);

  // Sync focused email to the global store for the command palette.
  useEffect(() => {
    if (focusedEmail) {
      setFocusedEmail({
        id: focusedEmail.id,
        fromAddr: focusedEmail.fromAddr,
        fromName: focusedEmail.fromName ?? null,
        subject: focusedEmail.subject ?? null,
        threadId: focusedEmail.threadId ?? null,
        mailboxId: focusedEmail.mailboxId ?? null,
      });
    } else {
      clearFocusedEmail();
    }
  }, [focusedEmail]);

  // Clear on unmount.
  useEffect(() => {
    return () => clearFocusedEmail();
  }, []);

  // Reset focus when the list is fully swapped out (e.g. view change → empty).
  useEffect(() => {
    if (groups.length === 0) setFocusedId(null);
  }, [groups.length]);

  return { focusedIndex, setFocusedId };
}
