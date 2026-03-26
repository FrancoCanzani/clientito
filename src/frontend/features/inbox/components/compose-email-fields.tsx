import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMailboxDisplayEmail } from "@/hooks/use-mailboxes";
import { ClockIcon } from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import { useMemo, useState } from "react";
import { AttachmentBar } from "./attachment-bar";
import { ComposeEditor } from "./compose-editor";
import { useComposeEmail } from "./compose-email-state";
import { RecipientInput } from "./recipient-input";
import { ScheduleSendPicker } from "./schedule-send-picker";

type ComposeEmailFieldsProps = {
  compose: ReturnType<typeof useComposeEmail>;
  bodyClassName?: string;
  onEscape?: () => void;
  recipientAutoFocus?: boolean;
  editorAutoFocus?: boolean;
};

function ForwardedMessagePreview({ html }: { html: string }) {
  const sanitized = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
      }),
    [html],
  );

  return (
    <div className="mt-8 pt-4">
      <div
        className={cn(
          "prose prose-sm max-w-none text-xs text-foreground",
          "[&_[data-forwarded-message]]:mt-0 [&_[data-forwarded-message]]:border-0 [&_[data-forwarded-message]]:p-0",
          "[&_[data-forwarded-header]]:mb-2 [&_[data-forwarded-header]]:font-medium [&_[data-forwarded-header]]:text-foreground/80",
          "[&_[data-forwarded-original-body]]:mt-3 [&_[data-forwarded-original-body]]:border-t [&_[data-forwarded-original-body]]:border-border/40 [&_[data-forwarded-original-body]]:pt-3",
        )}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}

export function ComposeEmailFields({
  compose,
  bodyClassName,
  onEscape,
  recipientAutoFocus = false,
  editorAutoFocus = false,
}: ComposeEmailFieldsProps) {
  const {
    to,
    setTo,
    mailboxId,
    setMailboxId,
    cc,
    setCc,
    bcc,
    setBcc,
    subject,
    setSubject,
    body,
    setBody,
    forwardedContent,
    canSend,
    availableMailboxes,
    send,
    scheduleSend,
    isPending,
    attachments,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);

  return (
    <div
      role="group"
      aria-label="Compose email"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onEscape?.();
        }
      }}
    >
      <div className="space-y-2 p-1">
        {availableMailboxes.length > 1 && (
          <Select
            value={mailboxId != null ? String(mailboxId) : undefined}
            onValueChange={(value) => setMailboxId(Number(value))}
          >
            <SelectTrigger
              className="h-auto w-full border-0 px-2 text-left text-sm text-muted-foreground shadow-none focus-visible:ring-0"
              size="default"
            >
              <SelectValue placeholder="Select sender" />
            </SelectTrigger>
            <SelectContent align="start">
              {availableMailboxes.map((mailbox) => (
                <SelectItem
                  key={mailbox.mailboxId}
                  value={String(mailbox.mailboxId)}
                >
                  {getMailboxDisplayEmail(mailbox) ?? "Unknown account"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center px-2 py-1 gap-2">
          <RecipientInput
            value={to}
            onChange={setTo}
            autoFocus={recipientAutoFocus}
          />
          <div className="flex items-center gap-2">
            {!showCc && (
              <button
                type="button"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => setShowCc(true)}
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => setShowBcc(true)}
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {showCc && (
          <div className="flex items-center gap-2">
            <RecipientInput value={cc} onChange={setCc} placeholder="Cc" />
            <button
              type="button"
              className="shrink-0 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setCc("");
                setShowCc(false);
              }}
            >
              &times;
            </button>
          </div>
        )}

        {showBcc && (
          <div className="flex items-center gap-2">
            <RecipientInput value={bcc} onChange={setBcc} placeholder="Bcc" />
            <button
              type="button"
              className="shrink-0 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setBcc("");
                setShowBcc(false);
              }}
            >
              &times;
            </button>
          </div>
        )}

        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-transparent py-1 px-2 text-xs outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="mx-2 border-t border-border/30" />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <ComposeEditor
          initialContent={body}
          onChange={setBody}
          onSend={() => {
            if (canSend) send();
          }}
          className={bodyClassName ?? "min-h-32 text-sm leading-relaxed"}
          autoFocus={editorAutoFocus}
        />
        {forwardedContent ? (
          <ForwardedMessagePreview html={forwardedContent} />
        ) : null}
      </div>

      <div className="mt-auto px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <AttachmentBar
            files={attachments.files}
            uploading={attachments.uploading}
            onAddFiles={(files) => attachments.addFiles(files)}
            onRemoveFile={attachments.removeFile}
          />
          <div className="flex items-center gap-1">
            <ScheduleSendPicker
              onSchedule={(timestamp) => void scheduleSend(timestamp)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!canSend}
              >
                <ClockIcon className="size-4" />
              </Button>
            </ScheduleSendPicker>
            <Button
              variant="secondary"
              onClick={() => send()}
              disabled={!canSend || isPending}
            >
              {isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
