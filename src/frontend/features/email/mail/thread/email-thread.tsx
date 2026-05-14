import type {
  EmailAttachment,
  EmailBodySource,
  EmailDetailItem,
  EmailListItem,
  EmailThreadItem,
} from "@/features/email/mail/types";
import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AttachmentItem } from "../compose/attachment-item";
import type { EmailBodyOverflowMode } from "../render/email-html-renderer";
import { MessageBody } from "../render/message-body";
import {
  formatEmailDetailDate,
  formatEmailThreadDate,
} from "../utils/formatters";
import { CalendarInviteCard } from "./calendar-invite-card";
import { EmailHeaderDetails } from "./email-header-details";

function normalizeCid(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

function collectReferencedCids(
  bodyHtml: string | null | undefined,
): Set<string> {
  const referenced = new Set<string>();
  if (!bodyHtml) return referenced;

  const cidAttrRegex = /data-cid="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = cidAttrRegex.exec(bodyHtml)) !== null) {
    const cid = match[1];
    if (!cid) continue;
    referenced.add(normalizeCid(cid));
  }

  return referenced;
}

function shouldHideInlineImageAttachment(
  attachment: EmailAttachment,
  referencedCids: Set<string>,
): boolean {
  if (!(attachment.isInline && attachment.isImage)) return false;
  if (!attachment.contentId) return false;
  return referencedCids.has(normalizeCid(attachment.contentId));
}

function formatAttachmentLabel(count: number): string {
  return count === 1 ? "1 attachment" : `${count} attachments`;
}

function AttachmentsSection({
  attachments,
}: {
  attachments: EmailAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section className="space-y-3 border-t border-border/40 px-5 py-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <PaperclipIcon className="size-3" />
        <span>{formatAttachmentLabel(attachments.length)}</span>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {attachments.map((attachment, index) => (
          <AttachmentItem
            key={attachment.attachmentId}
            attachment={attachment}
            previewAttachments={attachments}
            previewIndex={index}
          />
        ))}
      </div>
    </section>
  );
}

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

function formatSenderFull(email: Pick<EmailListItem, "fromAddr" | "fromName">) {
  const fromName = email.fromName?.trim();
  if (!fromName || fromName === email.fromAddr) return email.fromAddr;
  return `${fromName} <${email.fromAddr}>`;
}

export function EmailThread({
  email,
  threadMessages,
  threadError,
  overflowMode = "contained",
  onReplyToMessage,
}: {
  email: EmailDetailItem;
  threadMessages: EmailThreadItem[];
  threadError: boolean;
  overflowMode?: EmailBodyOverflowMode;
  onReplyToMessage?: (message: EmailThreadItem) => void;
}) {
  const [expansionOverrides, setExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const orderedThreadMessages = useMemo(
    () =>
      [...threadMessages].sort((left, right) => {
        if (left.date !== right.date) return left.date - right.date;
        return left.createdAt - right.createdAt;
      }),
    [threadMessages],
  );

  const formattedDate = formatEmailDetailDate(email.date);
  const subject = email.subject ?? "(no subject)";
  const recipientRows = buildRecipientRows(email);
  const showThread = Boolean(
    email.threadId && orderedThreadMessages.length > 1,
  );
  const selectedReferencedCids = useMemo(
    () => collectReferencedCids(email.resolvedBodyHtml ?? email.bodyHtml),
    [email.resolvedBodyHtml, email.bodyHtml],
  );
  const visibleAttachments = useMemo(
    () =>
      email.attachments.filter(
        (attachment) =>
          !shouldHideInlineImageAttachment(attachment, selectedReferencedCids),
      ),
    [email.attachments, selectedReferencedCids],
  );
  const hasAttachments = visibleAttachments.length > 0;

  const referencedCidsByMessageId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const message of orderedThreadMessages) {
      map.set(
        message.id,
        collectReferencedCids(message.resolvedBodyHtml ?? message.bodyHtml),
      );
    }
    return map;
  }, [orderedThreadMessages]);

  const defaultExpandedIds = useMemo(() => {
    const next = new Set<string>();
    const latest = orderedThreadMessages[orderedThreadMessages.length - 1];
    next.add(latest?.id ?? email.id);
    return next;
  }, [email.id, orderedThreadMessages]);

  useEffect(() => {
    setExpansionOverrides(new Map());
  }, [email.id, email.threadId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      latestMessageRef.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });
  }, [email.id, orderedThreadMessages.length]);

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
      <CalendarInviteCard email={email} />

      {threadError && showThread && (
        <p className="border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Could not load the full thread.
        </p>
      )}

      {showThread ? (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 text-sm font-medium text-foreground">
                {subject}
              </h1>
              <span className="shrink-0 font-mono text-[10px] tracking-tighter tabular-nums text-muted-foreground">
                {formattedDate}
              </span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

          <div className="space-y-3">
            {orderedThreadMessages.map((threadEmail) => {
              const isSelected = threadEmail.id === email.id;
              const threadReferencedCids =
                referencedCidsByMessageId.get(threadEmail.id) ??
                new Set<string>();
              return (
                <div
                  key={threadEmail.id}
                  className="scroll-mt-16"
                  ref={
                    threadEmail.id ===
                    orderedThreadMessages[orderedThreadMessages.length - 1]?.id
                      ? latestMessageRef
                      : undefined
                  }
                >
                  <ThreadMessage
                    email={threadEmail}
                    body={isSelected ? email : threadEmail}
                    expanded={isExpanded(threadEmail.id)}
                    onToggle={() => toggleMessage(threadEmail.id)}
                    onReply={onReplyToMessage}
                    overflowMode={overflowMode}
                    attachments={
                      isSelected
                        ? visibleAttachments
                        : (threadEmail.attachments ?? []).filter(
                            (attachment) =>
                              !shouldHideInlineImageAttachment(
                                attachment,
                                threadReferencedCids,
                              ),
                          )
                    }
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <article
          className={
            overflowMode === "page"
              ? "border border-border/40 bg-card shadow-xs"
              : "overflow-x-auto border border-border/40 bg-card shadow-xs"
          }
        >
          <header className="space-y-2 px-5 pt-5 pb-4">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="min-w-0 truncate text-xs font-medium text-foreground">
                {subject}
              </h1>
              <span className="shrink-0 font-mono text-[10px] tracking-tighter tabular-nums text-muted-foreground">
                {formattedDate}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {recipientRows.map((row) => (
                <p key={row.label} className="min-w-0">
                  <span className="mr-1 font-medium text-foreground/70">
                    {row.label}
                  </span>
                  <span>{row.value}</span>
                </p>
              ))}
            </div>
          </header>
          <div className="border-t border-border/40 p-5">
            <MessageBody detail={email} overflowMode={overflowMode} />
          </div>

          {hasAttachments && (
            <AttachmentsSection attachments={visibleAttachments} />
          )}
        </article>
      )}
    </div>
  );
}

function ThreadMessage({
  email,
  body,
  expanded,
  onToggle,
  onReply,
  attachments,
  overflowMode,
}: {
  email: EmailThreadItem;
  body?: EmailBodySource | null;
  expanded: boolean;
  onToggle: () => void;
  onReply?: (message: EmailThreadItem) => void;
  attachments: EmailAttachment[];
  overflowMode: EmailBodyOverflowMode;
}) {
  const formattedDate = formatEmailThreadDate(email.date);
  const senderName = formatSenderLabel(email);
  const senderFull = formatSenderFull(email);
  const hasAttachments = attachments.length > 0;

  return (
    <div
      className={
        overflowMode === "page"
          ? "border border-border/40 bg-card shadow-xs"
          : "overflow-x-auto border border-border/40 bg-card shadow-xs"
      }
    >
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:opacity-80"
        >
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
        </button>
        {expanded && <EmailHeaderDetails email={email} />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse message" : "Expand message"}
          className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="font-mono text-[10px] tracking-tighter tabular-nums">
            {formattedDate}
          </span>
          {expanded ? (
            <CaretDownIcon className="size-3" />
          ) : (
            <CaretRightIcon className="size-3" />
          )}
        </button>
      </div>

      {expanded && (
        <>
          <div className="border-t border-border/40 px-5 pb-5 pt-4">
            <MessageBody detail={body ?? email} overflowMode={overflowMode} />
          </div>

          {hasAttachments && <AttachmentsSection attachments={attachments} />}

          {onReply && (
            <div className="border-t border-border/40 px-4 py-2">
              <button
                type="button"
                onClick={() => onReply(email)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Reply
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
