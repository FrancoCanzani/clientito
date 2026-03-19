import { Button } from "@/components/ui/button";
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
  to?: string;
  cc?: string;
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
    cc,
    setCc,
    subject,
    setSubject,
    body,
    setBody,
    canSend,
    sendMutation,
    attachments,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);

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
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <RecipientInput
            value={to}
            onChange={setTo}
            autoFocus={recipientAutoFocus}
          />
        </div>
        {!showCc && (
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowCc(true)}
          >
            CC
          </button>
        )}
      </div>
      {showCc && (
        <RecipientInput
          value={cc}
          onChange={setCc}
          placeholder="CC"
        />
      )}
      <Input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <ComposeEditor
        initialContent={body}
        onChange={setBody}
        onSend={() => {
          if (canSend) sendMutation.mutate();
        }}
        className={bodyClassName ?? "min-h-45 flex-1 overflow-y-auto text-sm"}
        autoFocus={editorAutoFocus}
      />
      <AttachmentBar
        files={attachments.files}
        uploading={attachments.uploading}
        onAddFiles={(files) => attachments.addFiles(files)}
        onRemoveFile={attachments.removeFile}
      />
      <div className="flex justify-end">
        <Button onClick={() => sendMutation.mutate()} disabled={!canSend}>
          {sendMutation.isPending ? "Sending..." : "Send"}
        </Button>
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
