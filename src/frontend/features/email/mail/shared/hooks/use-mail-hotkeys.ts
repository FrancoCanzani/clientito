import type { MailAction } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/shared/mutations";
import type { EmailListItem } from "@/features/email/mail/shared/types";
import type { ThreadGroup } from "@/features/email/mail/thread/group-emails-by-thread";
import { clearFocusedEmail, setFocusedEmail } from "@/hooks/use-focused-email";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useEffect, useRef, useState } from "react";

type InboxHotkeysOptions = {
  groups: ThreadGroup[];
  view: string;
  onOpen: (email: EmailListItem) => void;
  onOpenInTab?: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onCompose: () => void;
  onSearch: () => void;
  onFocusChange?: (emailId: string | null) => void;
  onRefresh?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onCloseTab?: () => void;
  canSwitchTab?: boolean;
  canCloseTab?: boolean;
  enabled?: boolean;
};

export function useMailHotkeys({
  groups,
  onOpen,
  onOpenInTab,
  view,
  onAction,
  onCompose,
  onSearch,
  onFocusChange,
  onRefresh,
  onNextTab,
  onPrevTab,
  onCloseTab,
  canSwitchTab = false,
  canCloseTab = false,
  enabled = true,
}: InboxHotkeysOptions) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const lastIndexRef = useRef(-1);
  // Flipped true when the user actively drives focus (keyboard nav or click).
  // The list consults this to decide whether to steal DOM focus or just update
  // the visible highlight.
  const userMovedFocusRef = useRef(false);

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
    userMovedFocusRef.current = true;
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
      "inbox:open-in-tab": {
        action: () => {
          if (focusedEmail && onOpenInTab) onOpenInTab(focusedEmail);
        },
        enabled: enabled && Boolean(focusedEmail) && Boolean(onOpenInTab),
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
          const groupEmails = focusedGroup?.emails ?? [focusedEmail];
          if (focusedEmail.isRead) {
            const newestReceived = [...groupEmails]
              .filter((e) => e.direction !== "sent")
              .sort((a, b) => b.date - a.date)[0];
            const target = newestReceived ?? groupEmails[0] ?? focusedEmail;
            onAction("mark-unread", [target.id]);
            return;
          }
          onAction(
            "mark-read",
            groupEmails.map((email) => email.id),
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
      "reader:next-tab": {
        action: () => onNextTab?.(),
        enabled: enabled && canSwitchTab && Boolean(onNextTab),
      },
      "reader:prev-tab": {
        action: () => onPrevTab?.(),
        enabled: enabled && canSwitchTab && Boolean(onPrevTab),
      },
      "reader:close-tab": {
        action: () => onCloseTab?.(),
        enabled: enabled && canCloseTab && Boolean(onCloseTab),
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

  const initializedRef = useRef(false);
  const viewRef = useRef(view);

  useEffect(() => {
    const viewChanged = viewRef.current !== view;
    viewRef.current = view;

    if (viewChanged) {
      initializedRef.current = false;
    }

    if (groups.length === 0) {
      initializedRef.current = false;
      setFocusedId((current) => (current === null ? current : null));
      return;
    }

    if (initializedRef.current && !viewChanged) return;

    const defaultId = groups[0]?.representative.id ?? null;
    if (!defaultId) return;

    initializedRef.current = true;
    setFocusedId((current) => {
      if (viewChanged || current === null) {
        onFocusChange?.(defaultId);
        return defaultId;
      }
      const exists = groups.some(
        (group) => group.representative.id === current,
      );
      const next = exists ? current : defaultId;
      if (next !== current) onFocusChange?.(next);
      return next;
    });
  }, [groups, onFocusChange, view]);

  return {
    focusedIndex: enabled ? focusedIndex : -1,
    setFocusedId,
    userMovedFocusRef,
  };
}
