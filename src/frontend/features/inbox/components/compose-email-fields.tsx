import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { AttachmentBar } from "./attachment-bar";
import { ComposeEditor } from "./compose-editor";
import { useComposeEmail } from "./compose-email-state";
import { RecipientInput } from "./recipient-input";

export type ComposeInitial = {
  mailboxId?: number | null;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
};

type ComposeEmailFieldsProps = {
  compose: ReturnType<typeof useComposeEmail>;
  bodyClassName?: string;
  onEscape?: () => void;
  recipientAutoFocus?: boolean;
  editorAutoFocus?: boolean;
};

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
    canSend,
    availableMailboxes,
    send,
    isPending,
    attachments,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);

  return (
    <div
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
                  {mailbox.gmailEmail ?? "Unknown account"}
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
      </div>

      <div className="mt-auto px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <AttachmentBar
            files={attachments.files}
            uploading={attachments.uploading}
            onAddFiles={(files) => attachments.addFiles(files)}
            onRemoveFile={attachments.removeFile}
          />
          <Button
            variant={"secondary"}
            onClick={() => send()}
            disabled={!canSend}
          >
            {isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
