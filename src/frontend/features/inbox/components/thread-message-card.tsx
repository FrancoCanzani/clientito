import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import type {
  EmailAttachment,
  EmailBodySource,
  EmailListItem,
  EmailThreadItem,
} from "../types";
import { formatEmailThreadDate } from "../utils/formatters";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailHtmlRenderer } from "./email-html-renderer";

type PlainTextSections = {
  visibleText: string;
  quotedText: string | null;
};

const QUOTED_REPLY_LINE_PATTERNS = [
  /^On .+ wrote:\s*$/i,
  /^El .+ escribió:\s*$/i,
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^Begin forwarded message:\s*$/i,
];

function splitPlainTextQuotedContent(text: string): PlainTextSections {
  const normalized = text.trim();
  if (!normalized) {
    return { visibleText: "", quotedText: null };
  }

  const lines = normalized.split(/\r?\n/);
  const quotedStartIndex = lines.findIndex((line) =>
    QUOTED_REPLY_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())),
  );

  if (quotedStartIndex <= 0) {
    return { visibleText: normalized, quotedText: null };
  }

  const visibleText = lines.slice(0, quotedStartIndex).join("\n").trim();
  const quotedText = lines.slice(quotedStartIndex).join("\n").trim();

  if (!visibleText || !quotedText) {
    return { visibleText: normalized, quotedText: null };
  }

  return { visibleText, quotedText };
}

function PlainTextEmailRenderer({ text }: { text: string }) {
  const [showQuotedText, setShowQuotedText] = useState(false);
  const { visibleText, quotedText } = splitPlainTextQuotedContent(text);

  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap text-sm leading-6 text-foreground/88">
        {visibleText}
      </div>

      {quotedText && (
        <div className="rounded-xl border border-border/60 bg-muted/35 px-3 py-3">
          {!showQuotedText ? (
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowQuotedText(true)}
            >
              Show quoted text
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowQuotedText(false)}
              >
                Hide quoted text
              </button>
              <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {quotedText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatSenderLabel(
  email: Pick<EmailListItem, "fromAddr" | "fromName">,
) {
  const fromName = email.fromName?.trim();
  if (!fromName || fromName === email.fromAddr) {
    return email.fromAddr;
  }

  return `${fromName} <${email.fromAddr}>`;
}

export function MessageBody({ detail }: { detail?: EmailBodySource | null }) {
  const bodyHtml = detail?.resolvedBodyHtml ?? detail?.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText;
  const preparedHtml = bodyHtml ? prepareEmailHtml(bodyHtml) : null;

  if (preparedHtml) {
    return <EmailHtmlRenderer html={preparedHtml} />;
  }

  if (!bodyText) {
    return null;
  }

  return <PlainTextEmailRenderer text={bodyText} />;
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
