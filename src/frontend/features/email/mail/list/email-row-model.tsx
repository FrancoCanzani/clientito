import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import { type ReactNode } from "react";
import { HighlightedText } from "../search/highlighted-text";
import type { EmailListItem } from "../types";
import { formatEmailSnippet, formatRecipientList } from "../utils/formatters";
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
  const email = group.representative;
  const isStarred = email.labelIds.includes("STARRED");

  const threadCount = group.threadCount;

  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${formatRecipientList(email.toAddr)}`
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

  const handleOpen = () => onOpen(email);

  const hasMetaIcons = isStarred || email.hasCalendar || email.hasAttachment;

  return {
    threadCount,
    participantLabel,
    subject,
    snippet,
    handleOpen,
    hasMetaIcons,
    isStarred,
    email,
  };
}
