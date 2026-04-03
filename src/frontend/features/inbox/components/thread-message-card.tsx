import { cn } from "@/lib/utils";
import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import type { EmailDetailItem, EmailListItem } from "../types";
import { formatEmailThreadDate } from "../utils/formatters";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailHtmlRenderer } from "./email-html-renderer";

function buildPreview(email: EmailListItem, detail?: EmailDetailItem | null) {
  const rawText =
    detail?.resolvedBodyText ?? detail?.snippet ?? email.snippet ?? "";

  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "(no preview available)";
}

export function MessageBody({
  detail,
  previewText,
}: {
  detail?: EmailDetailItem | null;
  previewText?: string;
}) {
  const bodyHtml = detail?.resolvedBodyHtml ?? detail?.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText;
  const preparedHtml = bodyHtml ? prepareEmailHtml(bodyHtml) : null;

  if (preparedHtml) {
    return <EmailHtmlRenderer html={preparedHtml} />;
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/88">
      {bodyText ?? previewText ?? ""}
    </div>
  );
}

type ThreadMessageCardProps = {
  email: EmailListItem;
  detail?: EmailDetailItem | null;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  showAttachments: boolean;
};

export function ThreadMessageCard({
  email,
  detail,
  active,
  expanded,
  onToggle,
  showAttachments,
}: ThreadMessageCardProps) {
  const formattedDate = formatEmailThreadDate(email.date);
  const attachments = detail?.attachments ?? [];
  const preview = buildPreview(email, detail);

  return (
    <div
      className={cn(
        "border-b border-border/70 transition-colors duration-150 ease-out last:border-b-0",
        active && "bg-muted/[0.12]",
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-3 px-0 py-3 text-left transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.995]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {email.fromName || email.fromAddr}
                  </p>
                  {active && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Open
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {email.fromAddr}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tracking-tight">
                  {formattedDate}
                </span>
                {expanded ? (
                  <CaretDownIcon className="size-4 shrink-0" />
                ) : (
                  <CaretRightIcon className="size-4 shrink-0" />
                )}
              </div>
            </div>
            {!expanded && (
              <p className="mt-2 truncate text-sm text-muted-foreground">
                {preview}
              </p>
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border/50 pb-4 pt-4">
            <div className="ml-11 space-y-4">
              <div className="min-w-0">
                <MessageBody detail={detail} previewText={preview} />
              </div>

              {showAttachments && (
                <section className="space-y-1 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <PaperclipIcon className="size-3" />
                    Attachments
                  </div>
                  {attachments.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <AttachmentItem
                          key={attachment.attachmentId}
                          attachment={attachment}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
