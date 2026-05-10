import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import { fetchEmailDetail } from "@/features/email/mail/data/thread-detail";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { HighlightedText } from "../search/highlighted-text";
import type { EmailListItem } from "../types";
import { formatEmailSnippet } from "../utils/formatters";
import type { ThreadGroup } from "../utils/group-emails-by-thread";

export type EmailRowProps = {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onSnooze?: (group: ThreadGroup, timestamp: number | null) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  highlightTerms?: string[];
};

export function useEmailRowModel({
  group,
  view,
  onOpen,
  highlightTerms,
}: EmailRowProps) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);

  const email = group.representative;
  const isStarred = email.labelIds.includes("STARRED");

  const threadCount = group.threadCount;

  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  const subjectText = email.subject?.trim() || "(no subject)";
  const snippetText = formatEmailSnippet(email.snippet);

  const hasHighlights = (highlightTerms?.length ?? 0) > 0;
  const subject: ReactNode =
    hasHighlights && subjectText ? (
      <HighlightedText text={subjectText} terms={highlightTerms!} />
    ) : (
      subjectText
    );
  const snippet: ReactNode =
    hasHighlights && snippetText ? (
      <HighlightedText text={snippetText} terms={highlightTerms!} />
    ) : (
      snippetText
    );

  const handleMouseEnter = () => {
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

  const hasMetaIcons = isStarred || email.hasCalendar || email.hasAttachment;

  return {
    threadCount,
    participantLabel,
    subject,
    snippet,
    handleMouseEnter,
    handleOpen,
    handleKeyDown,
    hasMetaIcons,
    isStarred,
    email,
  };
}
