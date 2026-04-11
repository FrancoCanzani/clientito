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
  return `${fromName} <${email.fromAddr}>`;
}

function getCollapsedPreview(
  email: EmailListItem,
  detail?: EmailBodySource | null,
) {
  const text =
    detail?.resolvedBodyText ?? detail?.bodyText ?? email.snippet ?? "";
  return text.replace(/\s+/g, " ").trim();
}

export function EmailThread({
  email,
  threadMessages,
  threadError,
}: {
  email: EmailDetailItem;
  threadMessages: EmailThreadItem[];
  threadError: boolean;
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
    <div className="space-y-8">
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
        <div className="space-y-2">
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
              />
            );
          })}
        </div>
      ) : (
        <div>
          <div className="min-w-0">
            <MessageBody detail={email} />
          </div>

          {hasAttachments && (
            <section className="mt-5 space-y-3 border-t border-border/70 pt-5">
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
}: {
  email: EmailThreadItem;
  body?: EmailBodySource | null;
  expanded: boolean;
  onToggle: () => void;
  attachments: EmailAttachment[];
}) {
  const formattedDate = formatEmailThreadDate(email.date);
  const collapsedPreview = getCollapsedPreview(email, body ?? email);
  const senderLabel = formatSenderLabel(email);
  const hasAttachments = attachments.length > 0;

  return (
    <div className="border-b border-dashed last:border-b-0">
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-3 px-0 py-3 text-left transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.995]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {senderLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formattedDate}</span>
                {expanded ? (
                  <CaretDownIcon className="size-3 shrink-0" />
                ) : (
                  <CaretRightIcon className="size-3 shrink-0" />
                )}
              </div>
            </div>
          </div>
        </button>

        <div className="min-w-0 pb-4">
          {expanded ? (
            <MessageBody detail={body ?? email} />
          ) : (
            <p className="line-clamp-3 text-xs text-muted-foreground">
              {collapsedPreview}
            </p>
          )}

          {expanded && hasAttachments && (
            <section className="mt-5 space-y-1 border-t border-border/50 pt-4">
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
        </div>
      </div>
    </div>
  );
}
