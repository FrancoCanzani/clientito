import type { EmailDetailItem, EmailThreadItem } from "@/features/inbox/types";
import { PaperclipIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { formatEmailDetailDate } from "../utils/formatters";
import { AttachmentItem } from "./attachment-item";
import { MessageBody } from "./message-body";
import { ThreadMessageCard } from "./thread-message-card";

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

export function EmailThread({
  email,
  threadMessages,
  threadError,
}: {
  email: EmailDetailItem;
  threadMessages: EmailThreadItem[];
  threadError: boolean;
}) {
  const [threadExpansionOverrides, setThreadExpansionOverrides] = useState<
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
    threadExpansionOverrides.get(messageId) ?? defaultExpandedIds.has(messageId);

  const toggleMessage = (messageId: string) => {
    setThreadExpansionOverrides((current) => {
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
            const isSelectedMessage = threadEmail.id === email.id;

            return (
              <ThreadMessageCard
                key={threadEmail.id}
                email={threadEmail}
                body={isSelectedMessage ? email : threadEmail}
                expanded={isExpanded(threadEmail.id)}
                onToggle={() => toggleMessage(threadEmail.id)}
                attachments={isSelectedMessage ? email.attachments : []}
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
