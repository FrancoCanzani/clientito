import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { clearFocusedEmail, setFocusedEmail } from "@/hooks/use-focused-email";
import { useShortcuts } from "@/hooks/use-shortcuts";
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
  onRefresh?: () => void;
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
  onRefresh,
  enabled = true,
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
  const focusedGroup = groups[focusedIndex] ?? null;

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(next, groups.length - 1));
    const target = groups[clamped]?.representative.id ?? null;
    setFocusedId(target);
    onFocusChange?.(target);
  };

  useShortcuts(
    "inbox-list",
    {
      "inbox:next": {
        action: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex + 1),
        enabled: enabled && groups.length > 0,
      },
      "inbox:next-arrow": {
        action: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex + 1),
        enabled: enabled && groups.length > 0,
      },
      "inbox:prev": {
        action: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex - 1),
        enabled: enabled && groups.length > 0,
      },
      "inbox:prev-arrow": {
        action: () => moveFocus(focusedIndex < 0 ? 0 : focusedIndex - 1),
        enabled: enabled && groups.length > 0,
      },
      "inbox:open": {
        action: () => {
          if (focusedEmail) onOpen(focusedEmail);
        },
        enabled: enabled && Boolean(focusedEmail),
      },
      "action:archive": {
        action: () => {
          if (!focusedEmail) return;
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
        },
        enabled: enabled && Boolean(focusedEmail),
      },
      "action:toggle-read": {
        action: () => {
          if (!focusedEmail) return;
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
        },
        enabled: enabled && Boolean(focusedEmail),
      },
      "action:compose": {
        action: () => onCompose(),
        enabled,
      },
      "action:search": {
        action: () => onSearch(),
        enabled,
      },
      "action:star": {
        action: () => {
          if (!focusedEmail) return;
          const isStarred = focusedEmail.labelIds.includes("STARRED");
          onAction(
            isStarred ? "unstar" : "star",
            focusedGroup?.emails.map((email) => email.id) ?? [focusedEmail.id],
            focusedGroup?.threadId && focusedEmail.mailboxId
              ? {
                  threadId: focusedGroup.threadId,
                  mailboxId: focusedEmail.mailboxId,
                  labelIds: focusedEmail.labelIds,
                }
              : undefined,
          );
        },
        enabled: enabled && Boolean(focusedEmail),
      },
      "action:trash": {
        action: () => {
          if (!focusedEmail) return;
          onAction(
            "trash",
            focusedGroup?.emails.map((email) => email.id) ?? [focusedEmail.id],
            focusedGroup?.threadId && focusedEmail.mailboxId
              ? {
                  threadId: focusedGroup.threadId,
                  mailboxId: focusedEmail.mailboxId,
                  labelIds: focusedEmail.labelIds,
                }
              : undefined,
          );
        },
        enabled: enabled && Boolean(focusedEmail),
      },
      "action:refresh": {
        action: () => onRefresh?.(),
        enabled: enabled && Boolean(onRefresh),
      },
    },
    { enabled },
  );

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

  useEffect(() => {
    setFocusedId(null);
  }, [view]);

  // Reset focus when the list is fully swapped out (e.g. view change → empty).
  useEffect(() => {
    if (!enabled || groups.length === 0) setFocusedId(null);
  }, [enabled, groups.length]);

  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
  }, [view]);

  useEffect(() => {
    if (!enabled || groups.length === 0) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    const newestReceivedId =
      groups.find((group) => group.representative.direction === "received")
        ?.representative.id ?? null;
    const defaultId = newestReceivedId ?? groups[0]?.representative.id ?? null;
    if (!defaultId) return;
    setFocusedId((current) => {
      const exists = current
        ? groups.some((group) => group.representative.id === current)
        : false;
      const next = exists ? current : defaultId;
      if (next !== current) onFocusChange?.(next);
      initializedRef.current = true;
      return next;
    });
  }, [enabled, groups, onFocusChange, view]);

  return { focusedIndex: enabled ? focusedIndex : -1, setFocusedId };
}
