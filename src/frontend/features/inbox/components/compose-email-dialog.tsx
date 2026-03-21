import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AttachmentBar } from "./attachment-bar";
import { ComposeEditor } from "./compose-editor";
import { getComposeInitialKey, useComposeEmail } from "./compose-email-state";
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
    sendMutation,
    attachments,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);
  const flatInputClassName =
    "h-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onEscape?.();
        }
      }}
    >
      <div className="overflow-hidden border-y border-border/70">
        <div className="flex min-h-11 items-center gap-3 border-b border-border/70 px-0 py-2">
          <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            To
          </span>
          <RecipientInput
            value={to}
            onChange={setTo}
            autoFocus={recipientAutoFocus}
            inputClassName={flatInputClassName}
          />
          <div className="flex items-center gap-2 pl-2">
            {!showCc && (
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowCc(true)}
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowBcc(true)}
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {availableMailboxes.length > 1 ? (
          <div className="flex min-h-11 items-center gap-3 border-b border-border/70 px-0 py-2">
            <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              From
            </span>
            <Select
              value={mailboxId != null ? String(mailboxId) : undefined}
              onValueChange={(value) => setMailboxId(Number(value))}
            >
              <SelectTrigger
                className="h-auto w-full rounded-none border-0 px-0 py-0 text-left shadow-none focus-visible:ring-0"
                size="default"
              >
                <SelectValue placeholder="Select sender account" />
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
          </div>
        ) : null}

        {showCc && (
          <div className="flex min-h-11 items-center gap-3 border-b border-border/70 px-0 py-2 last:border-b-0">
            <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Cc
            </span>
            <RecipientInput
              value={cc}
              onChange={setCc}
              placeholder="Cc"
              inputClassName={flatInputClassName}
            />
          </div>
        )}

        {showBcc && (
          <div className="flex min-h-11 items-center gap-3 border-b border-border/70 px-0 py-2 last:border-b-0">
            <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Bcc
            </span>
            <RecipientInput
              value={bcc}
              onChange={setBcc}
              placeholder="Bcc"
              inputClassName={flatInputClassName}
            />
          </div>
        )}

        <div className="flex min-h-11 items-center gap-3 px-0 py-2">
          <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Subj
          </span>
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <ComposeEditor
        initialContent={body}
        onChange={setBody}
        onSend={() => {
          if (canSend) sendMutation.mutate();
        }}
        className={
          bodyClassName ??
          "min-h-45 flex-1 overflow-y-auto text-sm leading-7"
        }
        autoFocus={editorAutoFocus}
      />
      <div className="border-t border-border/70 pt-3">
        <div className="flex items-center justify-between gap-3">
          <AttachmentBar
            files={attachments.files}
            uploading={attachments.uploading}
            onAddFiles={(files) => attachments.addFiles(files)}
            onRemoveFile={attachments.removeFile}
          />
          <Button
            className="rounded-full px-3"
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
          >
          {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const composeKey = getComposeInitialKey(initial);
  const title = initial?.subject?.startsWith("Fwd:") ? "Forward" : "New Email";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ComposeEmailDialogBody
          key={composeKey}
          initial={initial}
          onSent={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ComposeEmailDialogBody({
  initial,
  onSent,
}: {
  initial?: ComposeInitial;
  onSent: () => void;
}) {
  const compose = useComposeEmail(initial, {
    onSent,
  });

  const hasInitialRecipient = (initial?.to?.trim().length ?? 0) > 0;

  return (
    <ComposeEmailFields
      compose={compose}
      recipientAutoFocus={!hasInitialRecipient}
      editorAutoFocus={hasInitialRecipient}
    />
  );
}
