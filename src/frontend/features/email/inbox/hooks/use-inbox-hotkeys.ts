import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/email/inbox/types";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useEffect, useState } from "react";

type InboxHotkeysOptions = {
  groups: ThreadGroup[];
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  onCompose: () => void;
};

export function useInboxHotkeys({
  groups,
  onOpen,
  onAction,
  onCompose,
}: InboxHotkeysOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedEmail = groups[focusedIndex]?.representative ?? null;

  useHotkeys({
    j: {
      enabled: groups.length > 0,
      onKeyDown: () =>
        setFocusedIndex((index) => Math.min(index + 1, groups.length - 1)),
    },
    k: {
      enabled: groups.length > 0,
      onKeyDown: () =>
        setFocusedIndex((index) => Math.max(index - 1, 0)),
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
  });

  // Reset focus when the list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [groups]);

  return { focusedIndex, setFocusedIndex };
}
