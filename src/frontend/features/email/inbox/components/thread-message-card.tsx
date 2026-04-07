import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import type {
  EmailAttachment,
  EmailBodySource,
  EmailListItem,
  EmailThreadItem,
} from "../types";
import { formatEmailThreadDate } from "../utils/formatters";
import { AttachmentItem } from "./attachment-item";
import { MessageBody } from "./message-body";

function formatSenderLabel(
  email: Pick<EmailListItem, "fromAddr" | "fromName">,
) {
  const fromName = email.fromName?.trim();
  if (!fromName || fromName === email.fromAddr) {
    return email.fromAddr;
  }

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

type ThreadMessageCardProps = {
  email: EmailThreadItem;
  body?: EmailBodySource | null;
  expanded: boolean;
  onToggle: () => void;
  attachments?: EmailAttachment[];
};

export function ThreadMessageCard({
  email,
  body,
  expanded,
  onToggle,
  attachments = [],
}: ThreadMessageCardProps) {
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {senderLabel}
                  </p>
                </div>
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
            <div>
              <MessageBody detail={body ?? email} />
            </div>
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
