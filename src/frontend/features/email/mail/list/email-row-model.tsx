import type { MailAction } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/shared/mutations";
import { prefetchThreadAi } from "@/features/email/ai/prefetch";
import { prefetchSender } from "@/features/email/mail/sender/prefetch";
import { type ReactNode } from "react";
import { HighlightedText } from "@/features/email/mail/search/highlighted-text";
import type { EmailListItem } from "@/features/email/mail/shared/types";
import { formatEmailSnippet, formatRecipientList } from "@/features/email/mail/shared/utils/formatters";
import type { ThreadGroup } from "@/features/email/mail/thread/group-emails-by-thread";

export type EmailRowProps = {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onOpenInTab?: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onSnooze?: (group: ThreadGroup, timestamp: number | null) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  highlightTerms?: string[];
  searchQuery?: string;
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

  const searchParticipantLabel =
    email.direction === "sent"
      ? email.toAddr
        ? `To ${formatRecipientList(email.toAddr)}`
        : "To unknown recipient"
      : email.fromName
        ? `${email.fromName} <${email.fromAddr}>`
        : email.fromAddr;

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
  const handlePointerEnter = () => {
    void prefetchThreadAi(email);
    if (email.direction !== "sent") {
      void prefetchSender(email.mailboxId, email.fromAddr);
    }
  };

  const hasMetaIcons = isStarred || email.hasCalendar || email.hasAttachment;

  return {
    threadCount,
    participantLabel,
    searchParticipantLabel,
    subject,
    snippet,
    handleOpen,
    handlePointerEnter,
    hasMetaIcons,
    isStarred,
    email,
  };
}
