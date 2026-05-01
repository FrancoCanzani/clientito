import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import type { EmailAICategory } from "@/db/schema";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { ThreadIdentifier } from "@/features/email/inbox/mutations";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import {
  getRowActions,
  type RowAction,
} from "@/features/email/inbox/utils/row-actions";
import type { Label } from "@/features/email/labels/types";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import type { EmailListItem } from "../../types";
import { formatEmailSnippet } from "../../utils/formatters";
import type { ThreadGroup } from "../../utils/group-emails-by-thread";

const MAX_VISIBLE_CHIPS = 2;

const AI_CATEGORY_CHIP: Record<
  EmailAICategory,
  { label: string; backgroundColor: string }
> = {
  action_required: {
    label: "Action Required",
    backgroundColor: "#f6c5be",
  },
  invoice: {
    label: "Invoice",
    backgroundColor: "#ffe6c7",
  },
  notification: {
    label: "Notification",
    backgroundColor: "#c9daf8",
  },
  newsletter: {
    label: "Newsletter",
    backgroundColor: "#b9e4d0",
  },
  fyi: {
    label: "FYI",
    backgroundColor: "#efefef",
  },
  unknown: {
    label: "Unknown",
    backgroundColor: "#cccccc",
  },
};

export type EmailRowProps = {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (
    action: EmailInboxAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  isFocused?: boolean;
  allLabels?: Label[];
};

export function useEmailRowModel({
  group,
  view,
  onOpen,
  onAction,
  allLabels,
}: EmailRowProps) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const [actionsMounted, setActionsMounted] = useState(false);

  const email = group.representative;
  const isStarred = email.labelIds.includes("STARRED");

  const userLabels = useMemo<Label[]>(() => {
    if (!allLabels) return [];
    const byGmailId = new Map(allLabels.map((l) => [l.gmailId, l]));
    const resolved: Label[] = [];
    for (const id of email.labelIds) {
      if (!id.startsWith("Label_")) continue;
      const label = byGmailId.get(id);
      if (label && !isInternalLabelName(label.name)) resolved.push(label);
    }
    return resolved;
  }, [allLabels, email.labelIds]);

  const threadCount = group.threadCount;
  const rowActions = getRowActions(view, email);

  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  const subject = email.subject?.trim() || "(no subject)";
  const snippet = formatEmailSnippet(email.snippet);
  const aiSummary = email.aiSummary?.trim()
    ? email.aiSummary.trim().replace(/\n{3,}/g, "\n\n")
    : null;

  const aiCategoryLabel = useMemo<Label | null>(() => {
    if (!email.aiCategory) return null;
    if (email.aiCategory === "unknown") return null;
    const config = AI_CATEGORY_CHIP[email.aiCategory];
    return {
      gmailId: `AI_${email.aiCategory}`,
      name: config.label,
      type: "system",
      textColor: null,
      backgroundColor: config.backgroundColor,
      messagesTotal: 0,
      messagesUnread: 0,
    };
  }, [email.aiCategory]);

  const handleMouseEnter = () => {
    if (!actionsMounted) setActionsMounted(true);
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    void queryClient.prefetchQuery({
      queryKey: emailQueryKeys.detail(email.id),
      queryFn: () =>
        fetchEmailDetail(email.id, {
          mailboxId: email.mailboxId ?? undefined,
          view,
        }),
      staleTime: 45_000,
      gcTime: 120_000,
    });
  };

  const handleOpen = () => onOpen(email);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(email);
    }
  };

  const runAction = (rowAction: RowAction) => {
    if (group.threadId && email.mailboxId) {
      onAction(
        rowAction.action,
        group.emails.map((entry) => entry.id),
        {
          threadId: group.threadId,
          mailboxId: email.mailboxId,
          labelIds: email.labelIds,
        },
      );
      return;
    }
    onAction(rowAction.action, [email.id]);
  };

  const visibleChips = userLabels.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenChipCount = userLabels.length - visibleChips.length;
  const hasMetaIcons = isStarred || email.hasCalendar || email.hasAttachment;

  return {
    threadCount,
    rowActions,
    participantLabel,
    subject,
    snippet,
    aiSummary,
    aiCategoryLabel,
    handleMouseEnter,
    handleOpen,
    handleKeyDown,
    runAction,
    visibleChips,
    hiddenChipCount,
    hasMetaIcons,
    isStarred,
    email,
    actionsMounted,
  };
}
