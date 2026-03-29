import { Button } from "@/components/ui/button";
import {
  ArrowBendUpLeftIcon,
  DotsThreeIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { sendEmail } from "../mutations";
import type { EmailDetailItem, EmailListItem } from "../types";
import { escapeHtml } from "../utils/escape-html";
import { formatQuotedDate } from "../utils/formatters";
import { AttachmentBar } from "./attachment-bar";

export type QuickReplyHandle = {
  scrollIntoViewAndFocus: () => void;
};

function buildQuotedText(
  email: EmailListItem,
  detail?: EmailDetailItem | null,
) {
  const bodyText =
    detail?.resolvedBodyText ?? detail?.bodyText ?? email.snippet ?? "";
  const from = email.fromName
    ? `${email.fromName} <${email.fromAddr}>`
    : email.fromAddr;
  const date = formatQuotedDate(email.date);
  return `On ${date}, ${from} wrote:\n${bodyText}`;
}

export const QuickReply = forwardRef<
  QuickReplyHandle,
  { email: EmailListItem; detail?: EmailDetailItem | null }
>(function QuickReply({ email, detail }, ref) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showQuoted, setShowQuoted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const attachments = useAttachmentUpload();

  useImperativeHandle(ref, () => ({
    scrollIntoViewAndFocus: () => {
      setFocused(true);
      containerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
      setTimeout(() => textareaRef.current?.focus(), 300);
    },
  }));

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const subject = email.subject
        ? `Re: ${email.subject.replace(/^Re:\s*/i, "")}`
        : "Re:";
      const attachmentKeys =
        attachments.files.length > 0
          ? attachments.getAttachmentKeys()
          : undefined;
      await sendEmail({
        mailboxId: email.mailboxId ?? undefined,
        to: email.fromAddr,
        subject,
        body: `<div style="white-space:pre-wrap">${escapeHtml(trimmed)}</div>`,
        threadId: email.threadId ?? undefined,
        attachments: attachmentKeys,
      });
      setBody("");
      setFocused(false);
      attachments.clear();
      toast.success("Reply sent");
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({
        queryKey: ["email-thread", email.threadId],
      });
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  }, [body, sending, email, queryClient, attachments]);

  const quotedText = buildQuotedText(email, detail);

  if (!focused) {
    return (
      <div ref={containerRef} className="mt-6">
        <button
          type="button"
          onClick={() => {
            setFocused(true);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }}
          className="flex w-full items-center gap-2 rounded-md border border-border/50 p-4 justify-center text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Click here to reply
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-6">
      <div className="rounded-md border border-border">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
          <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            to {email.fromName || email.fromAddr}
          </span>
        </div>

        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") {
                if (!body.trim()) {
                  setFocused(false);
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder="Write your reply..."
            rows={4}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowQuoted(!showQuoted)}
              className="inline-flex items-center justify-center rounded border border-border/60 px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={showQuoted ? "Hide quoted text" : "Show quoted text"}
            >
              <DotsThreeIcon className="size-4" weight="bold" />
            </button>

            {showQuoted && (
              <div className="mt-2 whitespace-pre-wrap border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground">
                {quotedText}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
          <AttachmentBar
            files={attachments.files}
            uploading={attachments.uploading}
            onAddFiles={(files) => attachments.addFiles(files)}
            onRemoveFile={attachments.removeFile}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setFocused(false);
                setBody("");
                setShowQuoted(false);
                attachments.clear();
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="h-7 px-3"
              disabled={!body.trim() || sending}
              onClick={handleSend}
            >
              <PaperPlaneTiltIcon className="mr-1 size-3" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
