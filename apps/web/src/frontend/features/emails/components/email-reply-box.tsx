import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SparkleIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { draftReply, sendEmail } from "../api";
import type { EmailDetailItem } from "../types";

export function EmailReplyBox({ email }: { email: EmailDetailItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        to: email.fromAddr,
        subject: email.subject
          ? email.subject.startsWith("Re:")
            ? email.subject
            : `Re: ${email.subject}`
          : "Re:",
        body,
        inReplyTo: email.gmailId,
        threadId: email.threadId ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Reply sent");
      setBody("");
      setExpanded(false);
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
      setBody(result.draft);
      textareaRef.current?.focus();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCancel = useCallback(() => {
    setBody("");
    setExpanded(false);
  }, []);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
      >
        Write your reply...
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        className="min-h-[80px] resize-none text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (body.trim().length > 0 && !sendMutation.isPending) {
              sendMutation.mutate();
            }
          }
        }}
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
            disabled={sendMutation.isPending || body.trim().length === 0}
          >
            {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
