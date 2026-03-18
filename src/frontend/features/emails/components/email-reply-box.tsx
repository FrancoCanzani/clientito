import { Button } from "@/components/ui/button";
import { SparkleIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { insertComposeContent } from "../compose-bridge";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { draftReply, sendEmail } from "../mutations";
import type { EmailDetailItem } from "../types";
import { AttachmentBar } from "./attachment-bar";
import { ComposeEditor } from "./compose-editor";
import { RecipientInput } from "./recipient-input";

export function EmailReplyBox({ email }: { email: EmailDetailItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [to, setTo] = useState(email.fromAddr);
  const bodyRef = useRef(body);
  const attachments = useAttachmentUpload();

  const handleBodyChange = useCallback((html: string) => {
    bodyRef.current = html;
    setBody(html);
  }, []);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        to,
        subject: email.subject
          ? email.subject.startsWith("Re:")
            ? email.subject
            : `Re: ${email.subject}`
          : "Re:",
        body: bodyRef.current,
        inReplyTo: email.gmailId,
        threadId: email.threadId ?? undefined,
        attachments:
          attachments.files.length > 0
            ? attachments.getAttachmentKeys()
            : undefined,
      }),
    onSuccess: () => {
      toast.success("Reply sent");
      setBody("");
      setExpanded(false);
      attachments.clear();
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({
        queryKey: ["email-detail", email.id],
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const draftMutation = useMutation({
    mutationFn: () => draftReply({ emailId: Number(email.id) }),
    onSuccess: (result) => {
      const html = result.draft.replace(/\n/g, "<br>");
      setBody(html);
      insertComposeContent(html);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCancel = useCallback(() => {
    setBody("");
    setExpanded(false);
    attachments.clear();
  }, [attachments]);

  const hasBody =
    body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
      >
        Write your reply...
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <RecipientInput value={to} onChange={setTo} />
      <ComposeEditor
        initialContent={body}
        onChange={handleBodyChange}
        onSend={() => {
          if (hasBody && !sendMutation.isPending) {
            sendMutation.mutate();
          }
        }}
        className="min-h-[80px] rounded-md border border-input px-3 py-2 text-sm"
        autoFocus
      />
      <AttachmentBar
        files={attachments.files}
        uploading={attachments.uploading}
        onAddFiles={(files) => attachments.addFiles(files)}
        onRemoveFile={attachments.removeFile}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => draftMutation.mutate()}
          disabled={draftMutation.isPending}
          className="gap-1.5 text-xs"
        >
          <SparkleIcon className="size-3.5" />
          {draftMutation.isPending ? "Drafting..." : "AI Draft"}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !hasBody}
          >
            {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
