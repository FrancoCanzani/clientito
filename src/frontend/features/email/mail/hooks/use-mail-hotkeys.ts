import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import { fetchEmailDetail } from "@/features/email/mail/queries";
import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
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
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onCompose: () => void;
  onSearch: () => void;
  onFocusChange?: (emailId: string | null) => void;
  enabled?: boolean;
};

export function useMailHotkeys({
  groups,
  onOpen,
  view,
  onAction,
  onCompose,
  onSearch,
  onFocusChange,
  enabled = true,
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
  const focusedGroup = groups[focusedIndex] ?? null;

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(next, groups.length - 1));
    const target = groups[clamped]?.representative.id ?? null;
    setFocusedId(target);
    onFocusChange?.(target);
  };

  useHotkeys({
    j: {
      enabled: enabled && groups.length > 0,
      onKeyDown: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex + 1),
    },
    k: {
      enabled: enabled && groups.length > 0,
      onKeyDown: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex - 1),
    },
    Enter: {
      enabled: enabled && Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onOpen(focusedEmail);
        }
      },
    },
    e: {
      enabled: enabled && Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onAction(
            view === "archived" || view === "trash"
              ? "move-to-inbox"
              : "archive",
            focusedGroup?.emails.map((email) => email.id) ?? [focusedEmail.id],
            focusedGroup?.threadId && focusedEmail.mailboxId
              ? {
                  threadId: focusedGroup.threadId,
                  mailboxId: focusedEmail.mailboxId,
                  labelIds: focusedEmail.labelIds,
                }
              : undefined,
          );
        }
      },
    },
    u: {
      enabled: enabled && Boolean(focusedEmail),
      onKeyDown: () => {
        if (focusedEmail) {
          onAction(
            focusedEmail.isRead ? "mark-unread" : "mark-read",
            focusedGroup?.emails.map((email) => email.id) ?? [focusedEmail.id],
            focusedGroup?.threadId && focusedEmail.mailboxId
              ? {
                  threadId: focusedGroup.threadId,
                  mailboxId: focusedEmail.mailboxId,
                  labelIds: focusedEmail.labelIds,
                }
              : undefined,
          );
        }
      },
    },
    c: {
      enabled,
      onKeyDown: () => onCompose(),
    },
    "/": (e) => {
      if (!enabled) return;
      e.preventDefault();
      onSearch();
    },
  });

  // Prefetch adjacent email details for instant navigation.
  useEffect(() => {
    if (!enabled || focusedIndex < 0) return;
    const neighbors = [focusedIndex - 1, focusedIndex + 1];
    for (const idx of neighbors) {
      const email = groups[idx]?.representative;
      if (!email) continue;
      const key = emailQueryKeys.detail(email.id);
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
  }, [enabled, focusedIndex, groups, queryClient]);

  // Sync focused email to the global store for the command palette.
  useEffect(() => {
    if (!enabled) {
      clearFocusedEmail();
    } else if (focusedEmail) {
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
  }, [enabled, focusedEmail]);

  // Clear on unmount.
  useEffect(() => {
    return () => clearFocusedEmail();
  }, []);

  // Reset focus when the list is fully swapped out (e.g. view change → empty).
  useEffect(() => {
    if (!enabled || groups.length === 0) setFocusedId(null);
  }, [enabled, groups.length]);

  return { focusedIndex: enabled ? focusedIndex : -1, setFocusedId };
}
