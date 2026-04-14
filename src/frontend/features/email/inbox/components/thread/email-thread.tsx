import { ContactAvatar } from "@/components/ui/contact-avatar";
import type {
  EmailAttachment,
  EmailBodySource,
  EmailDetailItem,
  EmailListItem,
  EmailThreadItem,
} from "@/features/email/inbox/types";
import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { formatEmailDetailDate, formatEmailThreadDate } from "../../utils/formatters";
import { AttachmentItem } from "../compose/attachment-item";
import { MessageBody } from "../renderer/message-body";

function buildRecipientRows(email: EmailDetailItem) {
  return [
    {
      label: "From",
      value: email.fromName
        ? `${email.fromName} <${email.fromAddr}>`
        : email.fromAddr,
    },
    { label: "To", value: email.toAddr ?? "me" },
    ...(email.ccAddr ? [{ label: "Cc", value: email.ccAddr }] : []),
  ];
}

function formatSenderLabel(
  email: Pick<EmailListItem, "fromAddr" | "fromName">,
) {
  const fromName = email.fromName?.trim();
  if (!fromName || fromName === email.fromAddr) return email.fromAddr;
  return fromName;
}

function formatSenderFull(
  email: Pick<EmailListItem, "fromAddr" | "fromName">,
) {
  const fromName = email.fromName?.trim();
  if (!fromName || fromName === email.fromAddr) return email.fromAddr;
  return `${fromName} <${email.fromAddr}>`;
}



export function EmailThread({
  email,
  threadMessages,
  threadError,
  readingMode = "original",
}: {
  email: EmailDetailItem;
  threadMessages: EmailThreadItem[];
  threadError: boolean;
  readingMode?: "detox" | "original";
}) {
  const [expansionOverrides, setExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());

  const formattedDate = formatEmailDetailDate(email.date);
  const subject = email.subject ?? "(no subject)";
  const recipientRows = buildRecipientRows(email);
  const showThread = Boolean(email.threadId && threadMessages.length > 1);
  const hasAttachments = email.attachments.length > 0;

  const defaultExpandedIds = useMemo(() => {
    const next = new Set<string>();
    const selected = threadMessages.find((message) => message.id === email.id);
    next.add(selected ? selected.id : email.id);
    return next;
  }, [email.id, threadMessages]);

  const isExpanded = (messageId: string) =>
    expansionOverrides.get(messageId) ?? defaultExpandedIds.has(messageId);

  const toggleMessage = (messageId: string) => {
    setExpansionOverrides((current) => {
      const next = new Map(current);
      next.set(messageId, !isExpanded(messageId));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="min-w-0 font-medium text-foreground">{subject}</h1>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {recipientRows.map((row) => (
                  <p key={row.label} className="min-w-0">
                    <span className="mr-1 font-medium text-foreground/70">
                      {row.label}
                    </span>
                    <span>{row.value}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formattedDate}
          </span>
        </div>
      </div>

      {threadError && showThread && (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Could not load the full thread.
        </p>
      )}

      {showThread ? (
        <div className="space-y-3">
          {threadMessages.map((threadEmail) => {
            const isSelected = threadEmail.id === email.id;
            return (
              <ThreadMessage
                key={threadEmail.id}
                email={threadEmail}
                body={isSelected ? email : threadEmail}
                expanded={isExpanded(threadEmail.id)}
                onToggle={() => toggleMessage(threadEmail.id)}
                attachments={isSelected ? email.attachments : []}
                readingMode={readingMode}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <div className="p-5">
            <MessageBody detail={email} readingMode={readingMode} />
          </div>

          {hasAttachments && (
            <section className="space-y-3 border-t border-border/70 px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <PaperclipIcon className="size-3" />
                Attachments
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {email.attachments.map((attachment) => (
                  <AttachmentItem
                    key={attachment.attachmentId}
                    attachment={attachment}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadMessage({
  email,
  body,
  expanded,
  onToggle,
  attachments,
  readingMode = "original",
}: {
  email: EmailThreadItem;
  body?: EmailBodySource | null;
  expanded: boolean;
  onToggle: () => void;
  attachments: EmailAttachment[];
  readingMode?: "detox" | "original";
}) {
  const formattedDate = formatEmailThreadDate(email.date);
  const senderName = formatSenderLabel(email);
  const senderFull = formatSenderFull(email);
  const hasAttachments = attachments.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ContactAvatar name={email.fromName} email={email.fromAddr} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {expanded ? senderFull : senderName}
          </p>
          {expanded && email.toAddr && (
            <p className="truncate text-xs text-muted-foreground">
              To: {email.toAddr}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formattedDate}</span>
          {expanded ? (
            <CaretDownIcon className="size-3" />
          ) : (
            <CaretRightIcon className="size-3" />
          )}
        </div>
      </button>

      {expanded && (
        <>
          <div className="border-t border-border/60 px-5 pb-5 pt-4">
            <MessageBody detail={body ?? email} readingMode={readingMode} />
          </div>

          {hasAttachments && (
            <section className="space-y-3 border-t border-border/70 px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PaperclipIcon className="size-3" />
                Attachments
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {attachments.map((attachment) => (
                  <AttachmentItem
                    key={attachment.attachmentId}
                    attachment={attachment}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
