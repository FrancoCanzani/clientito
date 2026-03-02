import { Skeleton } from "@/components/ui/skeleton";
import { PaperclipIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchEmailDetail } from "../queries/fetch-email-detail";
import type { EmailListItem } from "../types";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailHtmlRenderer } from "./email-html-renderer";

export function EmailDetailContent({ email }: { email: EmailListItem }) {
  const formattedDate = new Date(email.date).toLocaleString();

  const detailQuery = useQuery({
    queryKey: ["email-detail", email.id],
    queryFn: () => fetchEmailDetail(email.id),
    enabled: Boolean(email.id),
  });

  const detail = detailQuery.data;
  const bodyHtml = detail?.resolvedBodyHtml ?? email.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? email.bodyText;
  const attachments = detail?.attachments ?? [];
  const preparedHtml = useMemo(
    () => (bodyHtml ? prepareEmailHtml(bodyHtml) : null),
    [bodyHtml],
  );

  return (
    <div className="flex h-full min-h-0 flex-col items-start space-y-3">
      <div className="space-y-1 text-xs leading-relaxed">
        <p>
          <span className="text-muted-foreground">From: </span>
          <span className="font-medium">
            {email.fromName
              ? `${email.fromName} <${email.fromAddr}>`
              : email.fromAddr}
          </span>
        </p>
        {email.toAddr && (
          <p>
            <span className="text-muted-foreground">To: </span>
            {email.toAddr}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Date: </span>
          {formattedDate}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                We could not fetch live attachment data. Showing stored content.
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

            <div>
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
    </div>
  );
}
