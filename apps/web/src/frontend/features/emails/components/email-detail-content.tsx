import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchEmailDetail } from "../queries/fetch-email-detail";
import type { EmailListItem } from "../types";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailActionBar } from "./email-action-bar";
import type { ComposeInitial } from "./compose-email-dialog";
import { EmailHtmlRenderer } from "./email-html-renderer";

export function EmailDetailContent({
  email,
  onClose,
  onForward,
}: {
  email: EmailListItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
}) {
  const formattedDate = new Date(email.date).toLocaleString();
  const [loadLiveDetail, setLoadLiveDetail] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["email-detail", email.id],
    queryFn: () => fetchEmailDetail(email.id),
    staleTime: 60_000,
  });

  const liveQuery = useQuery({
    queryKey: ["email-detail-live", email.id],
    queryFn: () => fetchEmailDetail(email.id, { refreshLive: true }),
    enabled: loadLiveDetail,
    staleTime: 60_000,
  });

  const detail = liveQuery.data ?? detailQuery.data;
  const bodyHtml = detail?.resolvedBodyHtml ?? email.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? email.bodyText;
  const attachments = detail?.attachments ?? [];
  const preparedHtml = useMemo(
    () => (bodyHtml ? prepareEmailHtml(bodyHtml) : null),
    [bodyHtml],
  );

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col items-start overflow-hidden space-y-3">
      <div className="space-y-1 text-xs leading-relaxed">
        <div className="flex items-center justify-start space-x-2">
          <span className="font-medium">
            {email.fromName
              ? `${email.fromName} <${email.fromAddr}>`
              : email.fromAddr}
          </span>

          <span className="font-mono tracking-tight">{formattedDate}</span>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto w-full">
        {detailQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-[85%]" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {detailQuery.isError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not fetch email detail.
              </p>
            )}

            {email.hasAttachment && !loadLiveDetail && (
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  This email has attachments. Load live details to view/download
                  them.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLoadLiveDetail(true)}
                >
                  Load attachments
                </Button>
              </div>
            )}

            {liveQuery.isError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not load live attachment data.
              </p>
            )}

            {attachments.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <PaperclipIcon className="size-3.5" />
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

            <div className="min-w-0">
              {preparedHtml ? (
                <EmailHtmlRenderer html={preparedHtml} />
              ) : (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                  {bodyText ?? ""}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {detail && (
        <div className="w-full shrink-0 pt-2">
          <EmailActionBar
            email={detail}
            onClose={onClose}
            onForward={onForward}
          />
        </div>
      )}
    </div>
  );
}
