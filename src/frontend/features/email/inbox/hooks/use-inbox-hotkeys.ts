import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/email/inbox/types";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import {
  setFocusedEmail,
  clearFocusedEmail,
} from "@/hooks/use-focused-email";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useEffect, useRef, useState } from "react";

type InboxHotkeysOptions = {
  groups: ThreadGroup[];
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  onCompose: () => void;
  onSearch: () => void;
};

export function useInboxHotkeys({
  groups,
  onOpen,
  onAction,
  onCompose,
  onSearch,
}: InboxHotkeysOptions) {
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
          onAction("archive", [focusedEmail.id]);
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
          onAction("trash", [focusedEmail.id]);
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
