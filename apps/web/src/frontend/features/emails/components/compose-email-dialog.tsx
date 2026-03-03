import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { sendEmail } from "../api";

export type ComposeInitial = {
  to?: string;
  subject?: string;
  body?: string;
};

export function ComposeEmailDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState(initial?.to ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  const sendMutation = useMutation({
    mutationFn: () => sendEmail({ to, subject, body }),
    onSuccess: () => {
      toast.success("Email sent");
      setTo("");
      setSubject("");
      setBody("");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const canSend =
    to.trim().length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial?.subject?.startsWith("Fwd:") ? "Forward" : "New Email"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            autoFocus={!initial?.to}
          />
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            placeholder="Write your message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[120px] resize-none text-sm"
            autoFocus={Boolean(initial?.to)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (canSend) sendMutation.mutate();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend}
            >
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
